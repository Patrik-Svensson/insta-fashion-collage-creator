import type { protos } from "@google-cloud/vision";
import vision from "@google-cloud/vision";
import sharp from "sharp";

// Define types
type LocalizedObjectAnnotation = protos.google.cloud.vision.v1.ILocalizedObjectAnnotation;

const imageAnnotatorClient = new vision.ImageAnnotatorClient();

async function detectObjects(filePath: string): Promise<LocalizedObjectAnnotation[]> {
  if (!imageAnnotatorClient) {
    throw new Error("Image Annotator Client is not initialized");
  }

  if (!imageAnnotatorClient.objectLocalization) {
    throw new Error("Object Localization is not available");
  }

  const [result] = await imageAnnotatorClient.objectLocalization(filePath);
  return result.localizedObjectAnnotations || [];
}

async function cropImage(filePath: string, outputFilePath: string): Promise<void> {
  const objects = await detectObjects(filePath);

  // Find the person in the image
  const person = objects.find((object) => object.name?.toLowerCase() === "person");
  if (!person || !person.boundingPoly?.normalizedVertices) {
    throw new Error("No person detected in the image.");
  }

  const vertices = person.boundingPoly.normalizedVertices;

  if (vertices.length < 4) {
    throw new Error("Invalid bounding box vertices.");
  }

  // Calculate the center of the bounding box
  const centerX = (vertices[0].x! + vertices[1].x! + vertices[2].x! + vertices[3].x!) / 4;

  // Calculate the crop region
  const halfWidth = 0.25; // 50% width -> half of it on each side of the center
  const leftX = Math.max(centerX - halfWidth, 0);
  const rightX = Math.min(centerX + halfWidth, 1);
  const cropWidth = rightX - leftX;

  // Load the image and apply the crop
  const image = sharp(filePath);
  const metadata = await image.metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error("Failed to retrieve image metadata.");
  }

  const cropRegion = {
    left: Math.round(leftX * metadata.width),
    top: 0,
    width: Math.round(cropWidth * metadata.width),
    height: metadata.height,
  };

  await image.extract(cropRegion).toFile(outputFilePath);
  console.log(`Image cropped and saved to ${outputFilePath}`);
}

export { cropImage };
