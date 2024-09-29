import { ProductCategory } from "../models/__associations";
export async function generateProductCategoryId() {
    const maxProductCategoryId = await ProductCategory.max('productCategoryId');
    let newProductCategoryId;
    if (maxProductCategoryId) {
        newProductCategoryId = Number(maxProductCategoryId) + 1;
    } else {
        newProductCategoryId = 1;
    }

    return newProductCategoryId.toString().padStart(6, '0');
}