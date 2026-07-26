import process from "node:process";

const baseUrl = process.env.API_BASE_URL || "http://localhost:3000";
const email = process.env.SMOKE_USER_EMAIL || "";
const password = process.env.SMOKE_USER_PASSWORD || "";
const name = process.env.SMOKE_USER_NAME || "Smoke User";
const role = process.env.SMOKE_USER_ROLE || "student";

if (!email || !password) {
  console.error("Missing SMOKE_USER_EMAIL or SMOKE_USER_PASSWORD environment variables.");
  process.exit(1);
}

async function post(path, payload) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  return { status: response.status, data };
}

const signup = await post("/api/auth/signup", {
  name,
  email,
  password,
  role,
});

console.log("signup", signup.status, signup.data.error || "ok");

const signin = await post("/api/auth/signin", {
  email,
  password,
});

console.log("signin", signin.status, signin.data.error || "ok");

if (signin.status !== 200) {
  process.exit(1);
}

console.log("profile", signin.data.profile || null);
