import fetch from 'node-fetch';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';

const ADMIN_CAP = ""; 
const COUNTER = ""; 
const PACKAGE_ID = ""; 
const RECIPIENT = ""; 
const TEST_MNEMONIC = "";
const ALLOWED_ADDRESS = ""; 

const ENOKI_API_BASE_URL = 'https://api.enoki.mystenlabs.com/v1';
const ENOKI_API_KEY = '';

const toBase64 = (arrayBuffer) => Buffer.from(arrayBuffer).toString('base64');

const makeRequest = async (endpoint, method, body) => {
    try {
        const response = await fetch(`${ENOKI_API_BASE_URL}${endpoint}`, {
            method,
            headers: {
                Authorization: `Bearer ${ENOKI_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: body ? JSON.stringify(body) : undefined,
        });

        const data = await response.json();
        if (!response.ok) {
            console.error(`Error: ${response.status} - ${response.statusText}`);
            throw new Error(data?.message || 'Enoki API request failed');
        }

        return data;
    } catch (error) {
        console.error('Error in Enoki API request:', error);
        throw error;
    }
};

const sponsorGasTransaction = async (transactionBlockKindBytes, sender) => {
    try {
        return await makeRequest('/transaction-blocks/sponsor', 'POST', {
            network: 'testnet',
            transactionBlockKindBytes,
            sender,
            allowedAddresses: [ALLOWED_ADDRESS, RECIPIENT],
            allowedMoveCallTargets: [`${PACKAGE_ID}::stashed_airdrop::mint_and_transfer`],
        });
    } catch (error) {
        console.error('Error in sponsoring gas transaction:', error);
        throw error;
    }
};

const mintAndTransfer = async () => {
    try {
        const signer = Ed25519Keypair.deriveKeypair(TEST_MNEMONIC);
        const suiClient = new SuiClient({ url: getFullnodeUrl('testnet') });

        const tx = new Transaction();
        tx.setGasBudget(100000000);
        tx.moveCall({
            target: `${PACKAGE_ID}::stashed_airdrop::mint_and_transfer`,
            arguments: [
                tx.object(ADMIN_CAP),
                tx.object(COUNTER),
                tx.object(RECIPIENT),
            ],
        });
        const transactionBlockKindBytesArray = await tx.build({ client: suiClient, onlyTransactionKind: true });
        const transactionBlockKindBytes = toBase64(transactionBlockKindBytesArray);
        console.log('Running sponsor request...');
        const sponsorResponse = await sponsorGasTransaction(transactionBlockKindBytes, ALLOWED_ADDRESS);

        if (!sponsorResponse) {
            throw new Error('Failed to sponsor gas transaction');
        }

        const { bytes: sponsoredTransactionBytes, digest } = sponsorResponse.data;

        if (!sponsoredTransactionBytes) {
            console.error('Error: Sponsored transaction bytes are undefined');
            throw new Error('Sponsored transaction bytes are undefined');
        }

        const sponsoredTransactionBuffer = Buffer.from(sponsoredTransactionBytes, 'base64');
        console.log('Sponsored Transaction Buffer:', sponsoredTransactionBuffer);
        const signedData = signer.signTransaction(sponsoredTransactionBuffer);

        if (!signedData || !signedData.signature) {
            console.error('Error: Failed to sign the transaction or signature is undefined');
            throw new Error('Failed to sign the transaction or signature is undefined');
        }

        console.log('Signature:', signedData.signature);
        const executionResponse = await makeRequest(`/transaction-blocks/sponsor/${digest}`, 'POST', {
            signature: Buffer.from(signedData.signature).toString('base64'),
        });

        console.log('Execution Response:', executionResponse);
    } catch (error) {
        console.error('Error during mint_and_transfer execution:', error);
    }
};

mintAndTransfer();
