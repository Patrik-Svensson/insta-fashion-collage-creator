const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const { cropImage } = require('./center-image');

const createTextImage = async (text, width, height, backgroundColor) => {
  const svgText = `
    <svg width="${width}" height="${height}">
      <rect x="0" y="0" width="100%" height="100%" fill="rgb(${backgroundColor.r}, ${backgroundColor.g}, ${backgroundColor.b})" />
      <text x="50%" y="50%" font-size="36" dominant-baseline="middle" text-anchor="middle" fill="black" font-family="Arial">${text}</text>
    </svg>`;
  return Buffer.from(svgText);
};

const getAverageColor = async (imagePath, width) => {
  const { data } = await sharp(imagePath)
    .extract({ left: 0, top: 0, width, height: 1 }) 
    .raw()
    .toBuffer({ resolveWithObject: true });

  const [r, g, b] = [0, 1, 2].map(i => data[i]);

  return { r, g, b };
};

const combineImages = async (modelPath, productPath, logoPath, outputPath) => {
  try {
    // Crop the model image to keep the model centered
    const croppedModelImagePath = path.join(__dirname, 'cropped-model.png');
    await cropImage(modelPath, croppedModelImagePath);

    // Load the cropped model image and get its metadata
    const croppedModelImage = sharp(croppedModelImagePath);
    const modelMetadata = await croppedModelImage.metadata();

    // Set the final image height to match the height of the cropped model image
    const finalImageHeight = modelMetadata.height;
    const finalImageWidth = modelMetadata.width * 2; // Width will be twice the cropped model image width

    // Load the product image to get its original dimensions
    const productImage = sharp(productPath);
    const productMetadata = await productImage.metadata();

    // Calculate the scale factor to fit the product image within the right half without cropping
    const scaleFactor = Math.min(
      modelMetadata.width / productMetadata.width,
      finalImageHeight / productMetadata.height
    );

    // Resize the product image based on the scale factor
    const resizedProductImagePath = path.join(__dirname, 'resized-product.png');
    await productImage
      .resize({
        width: Math.round(productMetadata.width * scaleFactor),
        height: Math.round(productMetadata.height * scaleFactor),
      })
      .toFile(resizedProductImagePath);

    // Reload the resized product image to get its new dimensions
    const resizedProductImage = sharp(resizedProductImagePath);
    const resizedProductMetadata = await resizedProductImage.metadata();

    // Set paddingTop to place the product image at the bottom
    const paddingTop = finalImageHeight - resizedProductMetadata.height;

    // Get a color sample from the top border of the resized product image
    const paddingColor = await getAverageColor(resizedProductImagePath, resizedProductMetadata.width);

    // Create a square image with the same height as the model image to hold the product image
    const paddedProductImagePath = path.join(__dirname, 'padded-product.png');
    await sharp({
      create: {
        width: modelMetadata.width,
        height: finalImageHeight,
        channels: 3,
        background: paddingColor, // Use sampled color as background
      },
    })
    .composite([
      { input: resizedProductImagePath, top: paddingTop, left: 0 } // Place the product image at the bottom
    ])
    .toFile(paddedProductImagePath);

    // Combine the cropped model image and the padded product image side by side
    const combinedImagePath = path.join(__dirname, 'combined-image.png');
    await sharp({
      create: {
        width: finalImageWidth, // Final image width is twice the width of the cropped model image
        height: finalImageHeight,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    })
    .composite([
      { input: croppedModelImagePath, left: 0, top: 0 }, // Model on the left
      { input: paddedProductImagePath, left: modelMetadata.width, top: 0 }, // Product on the right
    ])
    .toFile(combinedImagePath);

    // Load the combined image and add the H&M logo scaled up and centered
    const logoImage = sharp(logoPath);
    const logoMetadata = await logoImage.metadata();

    // Resize the logo to be 30% of the cropped model image's width
    const logoSize = Math.floor(modelMetadata.width * 0.30); // Logo size as 30% of the cropped model image's width
    const resizedLogoImage = await logoImage.resize({
      width: logoSize,
      height: Math.floor((logoMetadata.height / logoMetadata.width) * logoSize), // Maintain aspect ratio
    }).toBuffer();

    // Create the product name text image with the same background color as the right side
    const textImageBuffer = await createTextImage('Oversized Resort Shirt', modelMetadata.width, 60, paddingColor);

    // Calculate top position for the text to be slightly further down below the logo
    const textTopPosition = logoSize + 70; // Moved slightly further down

    // Center the logo within the right half, above the product image
    const logoLeftPosition = modelMetadata.width + Math.floor((modelMetadata.width - logoSize) / 2);

    // Composite the logo and product name onto the combined image
    await sharp(combinedImagePath)
      .composite([
        { input: resizedLogoImage, top: 10, left: logoLeftPosition }, 
        { input: textImageBuffer, top: textTopPosition, left: modelMetadata.width } 
      ])
      .toFile(outputPath);

    console.log(`Image saved to ${outputPath}`);

    // Clean up temporary files
    fs.unlinkSync(croppedModelImagePath);
    fs.unlinkSync(resizedProductImagePath);
    fs.unlinkSync(paddedProductImagePath);
    fs.unlinkSync(combinedImagePath);

  } catch (error) {
    console.error('Error processing images:', error);
  }
};

// SET THESE PATHS
const MODEL_PATH = '';
const PRODUCT_IMAGE_PATH = '';
const LOGO_IMAGE_PATH = '';
const OUTPUT_PATH = '';

combineImages(MODEL_PATH, PRODUCT_IMAGE_PATH, LOGO_IMAGE_PATH, OUTPUT_PATH);
