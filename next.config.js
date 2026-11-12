module.exports = {
  reactStrictMode: true,
  distDir: process.env.BFF_PREVIEW === "true" ? ".next-preview" : ".next",
}
