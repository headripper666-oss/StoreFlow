// Usage: node upload.mjs <PAT> <owner> <repo>
// Example: node upload.mjs ghp_xxxx headripper666-oss storeflow-data

import { readFileSync } from "fs";

const [, , pat, owner, repo] = process.argv;
if (!pat || !owner || !repo) {
  console.error("Usage: node upload.mjs <PAT> <owner> <repo>");
  process.exit(1);
}

const API = "https://api.github.com";
const headers = {
  Authorization: `Bearer ${pat}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "Content-Type": "application/json",
};

async function uploadFile(path, localFile) {
  const url = `${API}/repos/${owner}/${repo}/contents/${path}`;

  // Check if file already exists (to get SHA for update)
  const checkRes = await fetch(url, { headers });
  const sha = checkRes.ok ? (await checkRes.json()).sha : undefined;

  const content = Buffer.from(readFileSync(localFile, "utf8")).toString(
    "base64",
  );
  const body = {
    message: `chore: initialize ${path}`,
    content,
    ...(sha ? { sha } : {}),
  };

  const res = await fetch(url, {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
  });
  if (res.ok) {
    console.log(`✓ ${path} uploaded`);
  } else {
    const err = await res.json();
    console.error(`✗ ${path} failed:`, err.message);
  }
}

await uploadFile("lists.json", "./lists.json");
await uploadFile("rayons.json", "./rayons.json");
await uploadFile("products.json", "./products.json");
console.log("\nDone! You can now log in to StoreFlow.");
