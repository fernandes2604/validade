// The 'use server' directive tells Next.js to run this code on the server.
'use server';

/**
 * @fileOverview Generates a product name from an EAN code.
 *
 * - generateProductName - A function that generates a product name from an EAN code.
 * - GenerateProductNameInput - The input type for the generateProductName function.
 * - GenerateProductNameOutput - The return type for the generateProductName function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const GenerateProductNameInputSchema = z.object({
  eanCode: z.string().describe('The EAN code of the product.'),
});
export type GenerateProductNameInput = z.infer<typeof GenerateProductNameInputSchema>;

const GenerateProductNameOutputSchema = z.object({
  productName: z.string().describe('The generated name of the product.'),
});
export type GenerateProductNameOutput = z.infer<typeof GenerateProductNameOutputSchema>;

export async function generateProductName(input: GenerateProductNameInput): Promise<GenerateProductNameOutput> {
  return generateProductNameFlow(input);
}

const generateProductNamePrompt = ai.definePrompt({
  name: 'generateProductNamePrompt',
  input: {
    schema: z.object({
      eanCode: z.string().describe('The EAN code of the product.'),
    }),
  },
  output: {
    schema: z.object({
      productName: z.string().describe('The generated name of the product.'),
    }),
  },
  prompt: `You are an expert in product identification.

  Based on the provided EAN code, generate a descriptive product name.

  EAN Code: {{{eanCode}}}
  `,
});

const generateProductNameFlow = ai.defineFlow<
  typeof GenerateProductNameInputSchema,
  typeof GenerateProductNameOutputSchema
>(
  {
    name: 'generateProductNameFlow',
    inputSchema: GenerateProductNameInputSchema,
    outputSchema: GenerateProductNameOutputSchema,
  },
  async input => {
    const {output} = await generateProductNamePrompt(input);
    return output!;
  }
);
