const vision = require("@google-cloud/vision");
const sharp = require("sharp");

const imageAnnotatorClient = new vision.ImageAnnotatorClient();

async function detectObjects(filePath) {
  if (imageAnnotatorClient === undefined) {
    throw new Error("Image Annotator Client is not initialized");
  }

  if (imageAnnotatorClient.objectLocalization === undefined) {
    throw new Error("Object Localization is not available");
  }

  const [result] = await imageAnnotatorClient.objectLocalization(filePath);
  const objects = result.localizedObjectAnnotations;

  return objects;
}

async function cropImage(filePath, outputFilePath) {
  const objects = await detectObjects(filePath);

  // Find the person in the image
  const person = objects.find((object) => object.name.toLowerCase() === "person");

  if (!person) {
    throw new Error("No person detected in the image.");
  }

  const vertices = person.boundingPoly.normalizedVertices;

  // Calculate the center of the bounding box
  const centerX = (vertices[0].x + vertices[1].x + vertices[2].x + vertices[3].x) / 4;

  // Calculate the crop region
  const halfWidth = 0.25; // 50% width -> half of it on each side of the center
  const leftX = Math.max(centerX - halfWidth, 0); // Ensure it doesn't go out of bounds
  const rightX = Math.min(centerX + halfWidth, 1);

  const cropWidth = rightX - leftX;

  // Load the image and apply the crop
  const image = sharp(filePath);
  const metadata = await image.metadata();

  const width = metadata.width;
  const height = metadata.height;

  const cropRegion = {
    left: Math.round(leftX * width),
    top: 0,
    width: Math.round(cropWidth * width),
    height: height,
  };

  await image.extract(cropRegion).toFile(outputFilePath);
  console.log(`Image cropped and saved to ${outputFilePath}`);
}

module.exports = { detectObjects, cropImage };