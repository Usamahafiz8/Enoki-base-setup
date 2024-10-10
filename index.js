import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { fromB64, toB64 } from "@mysten/bcs";
import { EnokiClient } from "@mysten/enoki";

const ADMIN_CAP = "0xa491abdb6cfb5ffa43afede84d402c6e1c35fa68e49a3c44c8d88746ccafaf9e"; 
const COUNTER = "0x8e81f7fecd2a5ef2bfe4814ac7f579f057d126dd53fb5446dfeaa33c2576bd72"; 
const PACKAGE_ID = "0x7ce5eaea08274f06d7c2b5c38449e53488bcca68304a30cc42cd4c4caacb1e02"; 

const RECIPIENT = "0x15414f44df059fb11946ce9f7b208730154c1ab6ba03f87a4fc6a422b85529d6"; // Receiving address

const TEST_MNEMONIC = "scrub obvious pause step segment raw agent dilemma boil minor express average";
const ALLOWED_ADDRESS = "0xf30f6eefbcc8583a3c5b82598d7cab5f3763b88fe4d7368c6635b4d8a6d3c8c1"; // Allowed address

const ENOKI_API_BASE_URL = 'https://api.enoki.mystenlabs.com/v1';
const ENOKI_API_KEY = 'enoki_private_ce83f7fe2a5b61110bdf749b39e5c3ed';

const suiClient = new SuiClient({ url: getFullnodeUrl('testnet') });


const signer = Ed25519Keypair.deriveKeypair(TEST_MNEMONIC);

const enokiClient = new EnokiClient({
    apiKey: ENOKI_API_KEY
});


const mintAndTransfer = async () => {
    try {
        const tx = new Transaction();
        tx.moveCall({
            target: `${PACKAGE_ID}::stashed_airdrop::mint_and_transfer`,
            arguments: [
                tx.object(ADMIN_CAP),
                tx.object(COUNTER),
                tx.object(RECIPIENT),
            ],
        });

        const transactionBlockKindBytesArray = await tx.build({ client: suiClient, onlyTransactionKind: true });
        const transactionBlockKindBytes = toB64(transactionBlockKindBytesArray);
        console.log('Running sponsor request...');

        const sponsorResponse = await enokiClient.createSponsoredTransaction({
            network: 'testnet',
            transactionKindBytes: transactionBlockKindBytes,
            sender: ALLOWED_ADDRESS,
            allowedAddresses: [ALLOWED_ADDRESS, RECIPIENT],
            allowedMoveCallTargets: [`${PACKAGE_ID}::stashed_airdrop::mint_and_transfer`],
        });

        if (!sponsorResponse) {
            throw new Error('Failed to sponsor gas transaction');
        }

        const signedData = await signer.signTransaction(fromB64(sponsorResponse.bytes));

        if (!signedData || !signedData.signature) {
            console.error('Error: Failed to sign the transaction or signature is undefined');
            throw new Error('Failed to sign the transaction or signature is undefined');
        }

        const executionResponse = await enokiClient.executeSponsoredTransaction({
            digest: sponsorResponse.digest, 
            signature: signedData.signature,
        });
        console.log('Execution Response:', executionResponse.digest);

    } catch (error) {
        console.error('Error during mint_and_transfer execution:', error);
    }
};

mintAndTransfer();
