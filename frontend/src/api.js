// The API base. Vercel serves the frontend and the API from one domain, so an
// unset value means "same origin". A browser on an https page blocks every
// http:// request as mixed content, so an http base (for example
// http://nilricems.vercel.app left in a deploy environment) is upgraded to
// https before anything is sent.
const configured = String(import.meta.env.VITE_API_URL || "")
  .trim()
  .replace(/\/+$/, "");

const page = typeof window !== "undefined" ? window.location : null;

let API_URL = configured || (page ? page.origin : "");

if (page?.protocol === "https:" && API_URL.startsWith("http://")) {
  API_URL = `https://${API_URL.slice("http://".length)}`;
}

export default API_URL;