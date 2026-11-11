import type { Demo } from "@/lib/types";

/**
 * Live demos. If HF_USERNAME is set, your public Hugging Face Spaces are listed
 * automatically (with the models they run). Add an entry with the same id to
 * override its text, or add demos hosted anywhere else.
 *
 * `embedUrl` lets visitors run the demo inside the page; leave it out for
 * sites that block iframes.
 *
 * The entries below are SAMPLE data — replace them with your own demos.
 */
export const localDemos: Demo[] = [
  {
    id: "your-username/nutrino-demo",
    name: "Snap your plate",
    description: "Upload a meal photo and get calories, macros, sugar and sodium in seconds.",
    sdk: "gradio",
    url: "https://huggingface.co/spaces/your-username/nutrino-demo",
    models: ["your-username/nutrino"],
    emoji: "",
    likes: 0,
    tags: ["nutrition", "vision"],
    updatedAt: "2026-10-27",
    source: "local",
  },
  {
    id: "your-username/ex-coach",
    name: "Ex form coach",
    description: "Turn on your webcam, do a few squats and get live rep counts and posture cues.",
    sdk: "gradio",
    url: "https://huggingface.co/spaces/your-username/ex-coach",
    models: ["your-username/ex-posture"],
    emoji: "",
    likes: 0,
    tags: ["fitness", "webcam"],
    updatedAt: "2026-10-27",
    source: "local",
  },
  {
    id: "your-username/nova-chat",
    name: "Nova chat",
    description: "Chat with Nova 1.1B Instruct, running on a free CPU Space.",
    sdk: "gradio",
    url: "https://huggingface.co/spaces/your-username/nova-chat",
    models: ["your-username/nova-1.1b-instruct"],
    emoji: "",
    likes: 0,
    tags: ["chat", "llm"],
    updatedAt: "2026-10-02",
    source: "local",
  },
];
