import { parse } from 'csv-parse';
import { Readable } from 'stream';
import { prisma } from '@/shared/database/client.js';
import { CreateProductData } from './admin-product.repository.js';
import { logger } from '@/shared/logger/winston.config.js';

export interface CSVImportRow {
  sku: string;
  name: string;
  slug: string;
  brandName?: string;
  categoryName: string;
  currentPrice: string;
  originalPrice?: string;
  inStock?: string;
  stockQuantity?: string;
  description?: string;
  partNumber?: string;
  metaTitle?: string;
  metaDescription?: string;
  compatibleVehicles?: string; // JSON string
  specifications?: string; // JSON string
}

export interface CSVImportError {
  row: number;
  data: Partial<CSVImportRow>;
  error: string;
}

export interface CSVImportResult {
  success: boolean;
  imported: number;
  failed: number;
  errors: CSVImportError[];
  duration: number;
}

/**
 * CSV Import Service
 * Handles bulk product imports from CSV files
 */
export class CSVImportService {
  /**
   * Parse CSV file from buffer
   */
  async parseCSV(fileBuffer: Buffer): Promise<CSVImportRow[]> {
    return new Promise((resolve, reject) => {
      const records: CSVImportRow[] = [];
      const stream = Readable.from(fileBuffer);

      stream
        .pipe(
          parse({
            columns: true, // Use first row as column names
            skip_empty_lines: true,
            trim: true,
            cast: false, // Keep all values as strings for validation
          })
        )
        .on('data', (record: CSVImportRow) => {
          records.push(record);
        })
        .on('error', (error) => {
          reject(error);
        })
        .on('end', () => {
          resolve(records);
        });
    });
  }

  /**
   * Validate and transform a single CSV row
   */
  async validateRow(
    row: CSVImportRow,
    rowNumber: number,
    brandCache: Map<string, number>,
    categoryCache: Map<string, number>
  ): Promise<{ valid: boolean; data?: CreateProductData; error?: string }> {
    try {
      // Required fields validation
      if (!row.sku || !row.name || !row.slug || !row.categoryName || !row.currentPrice) {
        return {
          valid: false,
          error: 'Missing required fields (sku, name, slug, categoryName, currentPrice)',
        };
      }

      // Validate SKU format
      if (row.sku.length > 100) {
        return { valid: false, error: 'SKU exceeds 100 characters' };
      }

      // Validate slug format (lowercase, alphanumeric, hyphens)
      if (!/^[a-z0-9-]+$/.test(row.slug)) {
        return {
          valid: false,
          error: 'Slug must contain only lowercase letters, numbers, and hyphens',
        };
      }

      // Validate and parse price
      const currentPrice = parseFloat(row.currentPrice);
      if (isNaN(currentPrice) || currentPrice <= 0) {
        return { valid: false, error: 'Invalid currentPrice (must be positive number)' };
      }

      let originalPrice: number | undefined;
      if (row.originalPrice) {
        originalPrice = parseFloat(row.originalPrice);
        if (isNaN(originalPrice) || originalPrice <= 0) {
          return { valid: false, error: 'Invalid originalPrice (must be positive number)' };
        }
      }

      // Lookup or validate category
      let categoryId: number;
      if (categoryCache.has(row.categoryName)) {
        const cachedId = categoryCache.get(row.categoryName);
        if (!cachedId) {
          return { valid: false, error: `Category '${row.categoryName}' cache error` };
        }
        categoryId = cachedId;
      } else {
        const category = await prisma.category.findFirst({
          where: {
            OR: [
              { name: { equals: row.categoryName, mode: 'insensitive' } },
              { slug: { equals: row.categoryName, mode: 'insensitive' } },
            ],
          },
          select: { id: true },
        });

        if (!category) {
          return { valid: false, error: `Category '${row.categoryName}' not found` };
        }

        categoryId = category.id;
        categoryCache.set(row.categoryName, categoryId);
      }

      // Lookup brand (optional)
      let brandId: number | undefined;
      if (row.brandName) {
        if (brandCache.has(row.brandName)) {
          brandId = brandCache.get(row.brandName);
        } else {
          const brand = await prisma.brand.findFirst({
            where: {
              OR: [
                { name: { equals: row.brandName, mode: 'insensitive' } },
                { slug: { equals: row.brandName, mode: 'insensitive' } },
              ],
            },
            select: { id: true },
          });

          if (!brand) {
            return { valid: false, error: `Brand '${row.brandName}' not found` };
          }

          brandId = brand.id;
          brandCache.set(row.brandName, brand.id);
        }
      }

      // Parse boolean fields
      const inStock =
        row.inStock === undefined ? true : row.inStock.toLowerCase() === 'true';
      const stockQuantity = row.stockQuantity ? parseInt(row.stockQuantity, 10) : 0;

      if (isNaN(stockQuantity) || stockQuantity < 0) {
        return { valid: false, error: 'Invalid stockQuantity (must be non-negative integer)' };
      }

      // Parse JSON fields
      let compatibleVehicles: any = null;
      if (row.compatibleVehicles) {
        try {
          compatibleVehicles = JSON.parse(row.compatibleVehicles);
        } catch {
          return { valid: false, error: 'Invalid compatibleVehicles JSON' };
        }
      }

      let specifications: any = null;
      if (row.specifications) {
        try {
          specifications = JSON.parse(row.specifications);
        } catch {
          return { valid: false, error: 'Invalid specifications JSON' };
        }
      }

      // Build CreateProductData
      const data: CreateProductData = {
        sku: row.sku,
        name: row.name,
        slug: row.slug,
        categoryId,
        currentPrice,
        brandId,
        originalPrice,
        inStock,
        stockQuantity,
        description: row.description || undefined,
        partNumber: row.partNumber || undefined,
        metaTitle: row.metaTitle || undefined,
        metaDescription: row.metaDescription || undefined,
        compatibleVehicles,
        specifications,
        currency: 'TND',
        status: 'ACTIVE',
      };

      return { valid: true, data };
    } catch (error) {
      logger.error('Row validation error', { error, rowNumber, row });
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown validation error',
      };
    }
  }

  /**
   * Import products from CSV
   */
  async importProducts(fileBuffer: Buffer, userId: string): Promise<CSVImportResult> {
    const startTime = Date.now();
    const errors: CSVImportError[] = [];
    let imported = 0;

    try {
      // Parse CSV
      logger.info('Starting CSV import', { userId });
      const rows = await this.parseCSV(fileBuffer);
      logger.info('CSV parsed successfully', { totalRows: rows.length });

      if (rows.length === 0) {
        return {
          success: false,
          imported: 0,
          failed: 0,
          errors: [{ row: 0, data: {}, error: 'CSV file is empty' }],
          duration: Date.now() - startTime,
        };
      }

      // Create caches for brand/category lookups
      const brandCache = new Map<string, number>();
      const categoryCache = new Map<string, number>();

      // Validate all rows first
      const validatedRows: Array<{
        rowNumber: number;
        data: CreateProductData;
        originalRow: CSVImportRow;
      }> = [];

      for (let i = 0; i < rows.length; i++) {
        const rowNumber = i + 2; // +2 because row 1 is headers, array is 0-indexed
        const row = rows[i];

        const validation = await this.validateRow(row, rowNumber, brandCache, categoryCache);

        if (validation.valid && validation.data) {
          validatedRows.push({ rowNumber, data: validation.data, originalRow: row });
        } else {
          errors.push({
            row: rowNumber,
            data: row,
            error: validation.error || 'Unknown error',
          });
        }
      }

      logger.info('Validation complete', {
        valid: validatedRows.length,
        invalid: errors.length,
      });

      // Batch import valid rows
      if (validatedRows.length > 0) {
        // Import in batches of 100 to avoid overwhelming the database
        const BATCH_SIZE = 100;
        for (let i = 0; i < validatedRows.length; i += BATCH_SIZE) {
          const batch = validatedRows.slice(i, i + BATCH_SIZE);

          for (const { rowNumber, data, originalRow } of batch) {
            try {
              // Check SKU uniqueness
              const existingSKU = await prisma.product.findUnique({
                where: { sku: data.sku },
                select: { id: true },
              });

              if (existingSKU) {
                errors.push({
                  row: rowNumber,
                  data: originalRow,
                  error: `SKU '${data.sku}' already exists`,
                });
                continue;
              }

              // Check slug uniqueness
              const existingSlug = await prisma.product.findUnique({
                where: { slug: data.slug },
                select: { id: true },
              });

              if (existingSlug) {
                errors.push({
                  row: rowNumber,
                  data: originalRow,
                  error: `Slug '${data.slug}' already exists`,
                });
                continue;
              }

              // Create product
              const product = await prisma.product.create({
                data: {
                  sku: data.sku,
                  name: data.name,
                  slug: data.slug,
                  brandId: data.brandId || null,
                  categoryId: data.categoryId,
                  description: data.description || null,
                  specifications: data.specifications || null,
                  currentPrice: data.currentPrice,
                  originalPrice: data.originalPrice || null,
                  currency: data.currency || 'TND',
                  inStock: data.inStock ?? true,
                  stockQuantity: data.stockQuantity ?? 0,
                  primaryImageUrl: data.primaryImageUrl || null,
                  metaTitle: data.metaTitle || null,
                  metaDescription: data.metaDescription || null,
                  status: data.status || 'ACTIVE',
                  compatibleVehicles: data.compatibleVehicles || null,
                  partNumber: data.partNumber || null,
                },
              });

              // Create price history
              await prisma.priceHistory.create({
                data: {
                  productId: product.id,
                  oldPrice: null,
                  newPrice: data.currentPrice,
                  changedBy: userId,
                  reason: 'CSV Import',
                },
              });

              imported++;
            } catch (error) {
              logger.error('Failed to import product', { error, rowNumber, data });
              errors.push({
                row: rowNumber,
                data: originalRow,
                error:
                  error instanceof Error ? error.message : 'Failed to create product',
              });
            }
          }

          // Log progress every batch
          logger.info('Import batch complete', {
            batch: Math.floor(i / BATCH_SIZE) + 1,
            imported,
            failed: errors.length,
          });
        }
      }

      const duration = Date.now() - startTime;

      logger.info('CSV import complete', {
        imported,
        failed: errors.length,
        totalRows: rows.length,
        duration,
      });

      return {
        success: true,
        imported,
        failed: errors.length,
        errors: errors.slice(0, 100), // Limit to first 100 errors in response
        duration,
      };
    } catch (error) {
      logger.error('CSV import failed', { error });
      throw error;
    }
  }
}
