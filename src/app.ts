import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { cropImage } from "./center-image"

interface RGBColor {
  r: number;
  g: number;
  b: number;
}

const createTextImage = async (text: string, width: number, height: number, backgroundColor: RGBColor): Promise<Buffer> => {
  const svgText = `
    <svg width="${width}" height="${height}">
      <rect x="0" y="0" width="100%" height="100%" fill="rgb(${backgroundColor.r}, ${backgroundColor.g}, ${backgroundColor.b})" />
      <text x="50%" y="50%" font-size="36" dominant-baseline="middle" text-anchor="middle" fill="black" font-family="Arial">${text}</text>
    </svg>`;
  return Buffer.from(svgText);
};

const getAverageColor = async (imagePath: string, width: number): Promise<RGBColor> => {
  const { data } = await sharp(imagePath)
    .extract({ left: 0, top: 0, width, height: 1 }) 
    .raw()
    .toBuffer({ resolveWithObject: true });

  const [r, g, b] = [0, 1, 2].map(i => data[i]);

  return { r, g, b };
};

const combineImages = async (modelPath: string, productPath: string, logoPath: string, outputPath: string): Promise<void> => {
  try {
    const croppedModelImagePath = path.join(__dirname, 'cropped-model.png');
    await cropImage(modelPath, croppedModelImagePath);

    const croppedModelImage = sharp(croppedModelImagePath);
    const modelMetadata = await croppedModelImage.metadata();

    const finalImageHeight = modelMetadata.height!;
    const finalImageWidth = modelMetadata.width! * 2;

    const productImage = sharp(productPath);
    const productMetadata = await productImage.metadata();

    const scaleFactor = Math.min(
      modelMetadata.width! / productMetadata.width!,
      finalImageHeight / productMetadata.height!
    );

    const resizedProductImagePath = path.join(__dirname, 'resized-product.png');
    await productImage
      .resize({
        width: Math.round(productMetadata.width! * scaleFactor),
        height: Math.round(productMetadata.height! * scaleFactor),
      })
      .toFile(resizedProductImagePath);

    const resizedProductImage = sharp(resizedProductImagePath);
    const resizedProductMetadata = await resizedProductImage.metadata();
    const paddingTop = finalImageHeight - resizedProductMetadata.height!;

    const paddingColor = await getAverageColor(resizedProductImagePath, resizedProductMetadata.width!);

    const paddedProductImagePath = path.join(__dirname, 'padded-product.png');
    await sharp({
      create: {
        width: modelMetadata.width!,
        height: finalImageHeight,
        channels: 3,
        background: paddingColor,
      },
    })
    .composite([{ input: resizedProductImagePath, top: paddingTop, left: 0 }])
    .toFile(paddedProductImagePath);

    const combinedImagePath = path.join(__dirname, 'combined-image.png');
    await sharp({
      create: {
        width: finalImageWidth,
        height: finalImageHeight,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    })
    .composite([
      { input: croppedModelImagePath, left: 0, top: 0 },
      { input: paddedProductImagePath, left: modelMetadata.width!, top: 0 },
    ])
    .toFile(combinedImagePath);

    const logoImage = sharp(logoPath);
    const logoMetadata = await logoImage.metadata();

    const logoSize = Math.floor(modelMetadata.width! * 0.30);
    const resizedLogoImage = await logoImage.resize({
      width: logoSize,
      height: Math.floor((logoMetadata.height! / logoMetadata.width!) * logoSize),
    }).toBuffer();

    const textImageBuffer = await createTextImage('Oversized Resort Shirt', modelMetadata.width!, 60, paddingColor);

    const textTopPosition = logoSize + 70;
    const logoLeftPosition = modelMetadata.width! + Math.floor((modelMetadata.width! - logoSize) / 2);

    await sharp(combinedImagePath)
      .composite([
        { input: resizedLogoImage, top: 10, left: logoLeftPosition },
        { input: textImageBuffer, top: textTopPosition, left: modelMetadata.width! },
      ])
      .toFile(outputPath);

    console.log(`Image saved to ${outputPath}`);

    fs.unlinkSync(croppedModelImagePath);
    fs.unlinkSync(resizedProductImagePath);
    fs.unlinkSync(paddedProductImagePath);
    fs.unlinkSync(combinedImagePath);
  } catch (error) {
    console.error('Error processing images:', error);
  }
};

const MODEL_PATH = '';
const PRODUCT_IMAGE_PATH = '';
const LOGO_IMAGE_PATH = '';
const OUTPUT_PATH = '';

combineImages(MODEL_PATH, PRODUCT_IMAGE_PATH, LOGO_IMAGE_PATH, OUTPUT_PATH);
