import { createServerFn } from "@tanstack/react-start";
import { recognizeWithVision } from "./ocr.server";

export const recognizeHandwritingFn = createServerFn({ method: "POST" })
  .validator((data: { image: string }) => {
    if (!data || typeof data.image !== "string") throw new Error("image is required");
    return { image: data.image };
  })
  .handler(async ({ data }) => recognizeWithVision(data.image));
