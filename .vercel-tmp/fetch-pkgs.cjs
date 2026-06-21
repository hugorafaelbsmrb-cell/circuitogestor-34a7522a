const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFreHBjZnFjYXN1YWJ4Ynd5cmV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5OTQ2OTksImV4cCI6MjA4MzU3MDY5OX0.i8o_GrdfMlNClnly4s87jx-ACgh1XFi18hpBhJNlmbU";

// First get the camp_id for colonia-2026
fetch("https://akxpcfqcasuabxbwyrew.supabase.co/rest/v1/vacation_camps?select=id,name&slug=eq.colonia-2026", {
  headers: { "apikey": key, "Authorization": "Bearer " + key }
}).then(r => r.json()).then(camps => {
  if (!camps.length) { console.log("Camp not found"); return; }
  const campId = camps[0].id;
  console.log("Camp:", camps[0].name, "| ID:", campId);
  
  fetch("https://akxpcfqcasuabxbwyrew.supabase.co/rest/v1/vacation_camp_packages?select=id,name,price,original_price,description,includes,active,max_slots,sold_count&camp_id=eq." + campId + "&order=sort_order", {
    headers: { "apikey": key, "Authorization": "Bearer " + key }
  }).then(r => r.json()).then(pkgs => {
    console.log("\nPACOTES:");
    pkgs.forEach((p, i) => {
      console.log(`\n${i+1}. ${p.name} | R$${p.price} | Ativo: ${p.active}`);
      console.log(`   Desc: ${p.description || '(vazia)'}`);
      console.log(`   Includes: ${JSON.stringify(p.includes)}`);
    });
  });
});
