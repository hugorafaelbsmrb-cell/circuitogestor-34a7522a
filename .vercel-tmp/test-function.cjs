const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFreHBjZnFjYXN1YWJ4Ynd5cmV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5OTQ2OTksImV4cCI6MjA4MzU3MDY5OX0.i8o_GrdfMlNClnly4s87jx-ACgh1XFi18hpBhJNlmbU";

fetch("https://akxpcfqcasuabxbwyrew.supabase.co/functions/v1/send-daily-schedule", {
  method: "POST",
  headers: { "Authorization": "Bearer " + key, "Content-Type": "application/json" },
}).then(r => r.text()).then(text => {
  console.log("Status:", "OK");
  console.log("Response:", text.slice(0, 500));
}).catch(e => console.log("Error:", e.message));
