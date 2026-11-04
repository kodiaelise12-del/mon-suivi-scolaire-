exports.handler = async function (event) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Méthode non autorisée." })
    };
  }

  if (!process.env.OPENAI_API_KEY) {
    return {
      statusCode: 503,
      headers,
      body: JSON.stringify({
        error: "Le serveur IA n'est pas encore configuré. Ajoute OPENAI_API_KEY dans les variables d'environnement de Netlify."
      })
    };
  }

  try {
    const payload = JSON.parse(event.body || "{}");
    const incoming = Array.isArray(payload.messages) ? payload.messages : [];

    const messages = incoming
      .filter(function (message) {
        return message &&
          (message.role === "user" || message.role === "assistant") &&
          typeof message.content === "string";
      })
      .slice(-12)
      .map(function (message) {
        return {
          role: message.role,
          content: message.content.slice(0, 3000)
        };
      });

    if (!messages.length || messages[messages.length - 1].role !== "user") {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Écris d'abord une question." })
      };
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + process.env.OPENAI_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "Tu es l'Assistant scolaire de MON SUIVI SCOLAIRE pour des élèves de collège et lycée, notamment Première D1 en Côte d'Ivoire. Réponds en français simple, encourageant et précis. Aide à comprendre les cours, résoudre les exercices étape par étape, réviser et s'organiser. Pour un exercice, explique la méthode et les étapes au lieu de donner seulement le résultat. Si une donnée manque, demande une seule précision. N'invente pas les informations du programme scolaire. Reste adapté à un public mineur : pas de contenu sexuel explicite, dangereux ou violent graphique. Ne demande jamais de mot de passe, adresse personnelle, numéro de téléphone ou autre donnée privée. Si la question n'est pas scolaire, réponds brièvement puis ramène gentiment l'élève à un usage utile et sûr."
          },
          ...messages
        ],
        temperature: 0.4,
        max_tokens: 900
      })
    });

    const result = await response.json();
    if (!response.ok) {
      console.error("OpenAI API error:", result && result.error ? result.error.message : response.status);
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({ error: "Le service IA rencontre un problème. Réessaie un peu plus tard." })
      };
    }

    const answer = result.choices &&
      result.choices[0] &&
      result.choices[0].message &&
      result.choices[0].message.content;

    if (!answer) {
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({ error: "Aucune réponse n'a été reçue." })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ answer: answer.trim() })
    };
  } catch (error) {
    console.error("Assistant function error:", error);
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Impossible de traiter cette demande. Vérifie le message et réessaie." })
    };
  }
};