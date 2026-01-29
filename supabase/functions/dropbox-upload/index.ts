import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

interface UploadRequest {
  fileName: string;
  base64Data: string;
  contentType: string;
  folder?: string;
}

interface ListFilesRequest {
  folder?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get Dropbox token from app_settings
    const { data: tokenSetting, error: tokenError } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "DROPBOX_ACCESS_TOKEN")
      .maybeSingle();

    if (tokenError) {
      console.error("Error fetching Dropbox token:", tokenError);
      return new Response(
        JSON.stringify({ error: "Erro ao buscar configuração do Dropbox" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!tokenSetting?.value) {
      return new Response(
        JSON.stringify({ error: "Token do Dropbox não configurado. Configure em Configurações > APIs." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const dropboxToken = tokenSetting.value;
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "upload";

    if (action === "list") {
      // List files from Dropbox folder
      const body: ListFilesRequest = await req.json().catch(() => ({}));
      const folder = body.folder || "/relatorios";

      console.log(`📁 Listando arquivos do Dropbox em: ${folder}`);

      const listResponse = await fetch("https://api.dropboxapi.com/2/files/list_folder", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${dropboxToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          path: folder === "/" ? "" : folder,
          recursive: false,
          include_media_info: true,
          include_deleted: false,
        }),
      });

      if (!listResponse.ok) {
        const errorText = await listResponse.text();
        console.error("Dropbox list error:", errorText);
        
        // Handle path not found - return empty list
        if (listResponse.status === 409) {
          return new Response(
            JSON.stringify({ success: true, files: [] }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        return new Response(
          JSON.stringify({ error: `Erro ao listar arquivos: ${errorText}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const listData = await listResponse.json();
      
      // Get shared links for each file
      const filesWithLinks = await Promise.all(
        listData.entries
          .filter((entry: any) => entry[".tag"] === "file")
          .map(async (file: any) => {
            try {
              // Try to get existing shared link
              const linkResponse = await fetch("https://api.dropboxapi.com/2/sharing/list_shared_links", {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${dropboxToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  path: file.path_lower,
                  direct_only: true,
                }),
              });

              let sharedLink = null;
              if (linkResponse.ok) {
                const linkData = await linkResponse.json();
                if (linkData.links && linkData.links.length > 0) {
                  sharedLink = linkData.links[0].url.replace("?dl=0", "?raw=1");
                }
              }

              // Create shared link if none exists
              if (!sharedLink) {
                const createLinkResponse = await fetch("https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings", {
                  method: "POST",
                  headers: {
                    "Authorization": `Bearer ${dropboxToken}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    path: file.path_lower,
                    settings: {
                      requested_visibility: "public",
                    },
                  }),
                });

                if (createLinkResponse.ok) {
                  const createLinkData = await createLinkResponse.json();
                  sharedLink = createLinkData.url.replace("?dl=0", "?raw=1");
                }
              }

              return {
                id: file.id,
                name: file.name,
                path: file.path_lower,
                size: file.size,
                modified: file.server_modified,
                url: sharedLink,
              };
            } catch (e) {
              console.error(`Error getting link for ${file.name}:`, e);
              return {
                id: file.id,
                name: file.name,
                path: file.path_lower,
                size: file.size,
                modified: file.server_modified,
                url: null,
              };
            }
          })
      );

      return new Response(
        JSON.stringify({ success: true, files: filesWithLinks }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "upload") {
      // Upload file to Dropbox
      const body: UploadRequest = await req.json();
      const { fileName, base64Data, contentType, folder = "/relatorios" } = body;

      if (!fileName || !base64Data) {
        return new Response(
          JSON.stringify({ error: "Nome do arquivo e dados são obrigatórios" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Decode base64 to binary
      const binaryString = atob(base64Data.split(",").pop() || base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Create unique filename
      const timestamp = Date.now();
      const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
      const dropboxPath = `${folder}/${timestamp}_${safeName}`;

      console.log(`📤 Uploading to Dropbox: ${dropboxPath}`);

      // Upload to Dropbox
      const uploadResponse = await fetch("https://content.dropboxapi.com/2/files/upload", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${dropboxToken}`,
          "Dropbox-API-Arg": JSON.stringify({
            path: dropboxPath,
            mode: "add",
            autorename: true,
            mute: false,
          }),
          "Content-Type": "application/octet-stream",
        },
        body: bytes,
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error("Dropbox upload error:", errorText);
        return new Response(
          JSON.stringify({ error: `Erro no upload: ${errorText}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const uploadData = await uploadResponse.json();
      console.log("📦 Upload successful:", uploadData);

      // Create shared link
      const shareResponse = await fetch("https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${dropboxToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          path: uploadData.path_lower,
          settings: {
            requested_visibility: "public",
          },
        }),
      });

      let sharedUrl = null;
      if (shareResponse.ok) {
        const shareData = await shareResponse.json();
        // Convert to direct link format for images
        sharedUrl = shareData.url.replace("?dl=0", "?raw=1");
      } else {
        // Try to get existing shared link
        const existingLinkResponse = await fetch("https://api.dropboxapi.com/2/sharing/list_shared_links", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${dropboxToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            path: uploadData.path_lower,
            direct_only: true,
          }),
        });

        if (existingLinkResponse.ok) {
          const existingData = await existingLinkResponse.json();
          if (existingData.links && existingData.links.length > 0) {
            sharedUrl = existingData.links[0].url.replace("?dl=0", "?raw=1");
          }
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          file: {
            id: uploadData.id,
            name: uploadData.name,
            path: uploadData.path_lower,
            size: uploadData.size,
            url: sharedUrl,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "delete") {
      // Delete file from Dropbox
      const { path } = await req.json();

      if (!path) {
        return new Response(
          JSON.stringify({ error: "Caminho do arquivo é obrigatório" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`🗑️ Deleting from Dropbox: ${path}`);

      const deleteResponse = await fetch("https://api.dropboxapi.com/2/files/delete_v2", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${dropboxToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ path }),
      });

      if (!deleteResponse.ok) {
        const errorText = await deleteResponse.text();
        console.error("Dropbox delete error:", errorText);
        return new Response(
          JSON.stringify({ error: `Erro ao deletar: ${errorText}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Ação inválida" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in dropbox-upload function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
