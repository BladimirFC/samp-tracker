// Run: node register-commands.mjs

const APP_ID = "TU_APPLICATION_ID";
const BOT_TOKEN = "TU_BOT_TOKEN";

const commands = [
  {
    name: "report",
    description: "Crear un reporte de bug/sugerencia en el tracker",
    options: [],
  },
];

async function register() {
  console.log("Registrando comandos de slash...");

  const res = await fetch(
    `https://discord.com/api/v10/applications/${APP_ID}/commands`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bot ${BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(commands),
    }
  );

  const data = await res.json();

  if (res.ok) {
    console.log("✅ Comandos registrados:");
    data.forEach((cmd) => console.log(`  /${cmd.name} — ${cmd.description}`));
  } else {
    console.error("❌ Error:", data);
  }
}

register();
