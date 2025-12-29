'use server';

/**
 * @fileOverview Fraud detection and prevention flow.
 *
 * - fraudDetection - A function that handles fraud detection and prevention.
 * - FraudDetectionInput - The input type for the fraudDetection function.
 * - FraudDetectionOutput - The return type for the fraudDetection function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const FraudDetectionInputSchema = z.object({
  transactionDetails: z
    .string()
    .describe('Details of the transaction, including amount, sender, receiver, timestamp, and location.'),
  userProfile: z.string().describe('User profile information, including transaction history and personal details.'),
});
export type FraudDetectionInput = z.infer<typeof FraudDetectionInputSchema>;

const FraudDetectionOutputSchema = z.object({
  isFraudulent: z.boolean().describe('Whether the transaction is likely fraudulent.'),
  fraudExplanation: z.string().describe('Explanation of why the transaction is considered fraudulent.'),
  riskScore: z.number().describe('A score indicating the risk level of the transaction (0-100).'),
});
export type FraudDetectionOutput = z.infer<typeof FraudDetectionOutputSchema>;

export async function fraudDetection(input: FraudDetectionInput): Promise<FraudDetectionOutput> {
  return fraudDetectionFlow(input);
}

const fraudDetectionPrompt = ai.definePrompt({
  name: 'fraudDetectionPrompt',
  input: {schema: FraudDetectionInputSchema},
  output: {schema: FraudDetectionOutputSchema},
  prompt: `You are an expert fraud detection system for a core banking platform. Analyze the transaction details and user profile to identify potential fraudulent activities.

Transaction Details: {{{transactionDetails}}}
User Profile: {{{userProfile}}}

Determine if the transaction is likely fraudulent. Provide a fraud explanation and a risk score between 0 and 100.
Consider factors such as unusual transaction patterns, high transaction amounts, and suspicious user behavior.`,
});

const fraudDetectionFlow = ai.defineFlow(
  {
    name: 'fraudDetectionFlow',
    inputSchema: FraudDetectionInputSchema,
    outputSchema: FraudDetectionOutputSchema,
  },
  async input => {
    const {output} = await fraudDetectionPrompt(input);
    return output!;
  }
);
