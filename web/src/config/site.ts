export const site = {
  name: "Gradient Garage",
  /** Short mark shown in the logo square */
  mark: "gg",
  tagline: "Open-source models, fine-tunes and benchmarks.",
  author: "Sumit",
  authorRole: "ML engineer and creator of Gradient Garage",
  /** Your Hugging Face username or org. Models are pulled live from it when set. */
  hfUsername: process.env.HF_USERNAME ?? "",
  githubUrl: process.env.NEXT_PUBLIC_GITHUB_URL ?? "https://github.com",
  license: "MIT",
};
