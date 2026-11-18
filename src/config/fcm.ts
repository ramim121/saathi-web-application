import fs from 'fs';
import admin from 'firebase-admin';
import AppFcmToken from '@/models/AppFcmToken';

/**
 * Firebase Cloud Messaging: push notifications to the mobile app.
 *
 * The service-account key is a JSON file kept on the server, outside the
 * repository, at the path in FIREBASE_SERVICE_ACCOUNT_PATH. Never commit it:
 * this repository is public, and Google disables any service-account key it
 * finds in a public repository. That is how the previous key, committed as
 * src/config/firebase.json, stopped working on 2026-09-13.
 *
 * Without a key nothing fails: sends are skipped, and the start-up token
 * check does not run.
 */

const TOKEN_CHECK_EVERY_MS = 1000 * 60 * 60 * 12;
const TOKEN_GONE = new Set(['messaging/invalid-registration-token', 'messaging/registration-token-not-registered']);

// undefined: not tried yet; null: no usable key.
let firebase: admin.app.App | null | undefined;

function loadApp(): admin.app.App | null {
    if (admin.apps.length) return admin.app();
    const file = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    if (!file) {
        console.warn('Push notifications are off: FIREBASE_SERVICE_ACCOUNT_PATH is not set.');
        return null;
    }
    try {
        const account = JSON.parse(fs.readFileSync(file, 'utf8'));
        return admin.initializeApp({ credential: admin.credential.cert(account as admin.ServiceAccount) });
    } catch (error) {
        console.error(`Push notifications are off: the Firebase key at ${file} could not be loaded: ${(error as Error).message}`);
        return null;
    }
}

function messaging(): admin.messaging.Messaging | null {
    if (firebase === undefined) firebase = loadApp();
    return firebase ? firebase.messaging() : null;
}

export default async function sendNotif(to: string, title: string, body: string) {
    const fcm = messaging();
    if (!fcm) return undefined;
    const message = {
        token: to,
        notification: {
            title,
            body,
        },
        android: {
            notification: {
                channelId: "saathi-app-001",
                icon: "@mipmap/ic_launcher",
            },
        },
    };

    try {
        const response = await fcm.send(message);
        console.log((new Date()).toISOString() + ' Mobile notification:', to, response);
        return response;
    } catch (error: any) {
        console.error("____" + (new Date()).toISOString() + " " + 'Mobile notification error:', to, error.errorInfo);
    }
};

export async function sendNotificationToTopic(topic: string, title: string, body: string, data = {}) {
    console.log('Sending notification to topic:', topic);
    try {
        const fcm = messaging();
        if (!fcm) throw new Error('Push notifications are not configured (FIREBASE_SERVICE_ACCOUNT_PATH).');

        // Validate topic name (Firebase has specific requirements for topic names)
        if (!isValidTopicName(topic)) {
            throw new Error('Invalid topic name. Must only contain letters, numbers, hyphens, and underscores.');
        }

        const message = {
            notification: {
                title,
                body
            },
            data,
            // High priority settings
            android: {
                priority: 'high',
                notification: {
                    channel_id: 'saathi-app-001' // Make sure this channel exists in your Android app
                }
            },
            apns: {
                headers: {
                    'apns-priority': '10',
                },
                payload: {
                    aps: {
                        sound: 'default'
                    }
                }
            },
            topic: topic
        };

        const response = await fcm.send(message as admin.messaging.Message);
        return {
            success: true,
            messageId: response,
            topic
        };

    } catch (error) {
        console.error('Error sending notification to topic:', error);
        throw error;
    }
}

// Helper function to validate topic name
function isValidTopicName(topic: string) {
    // Topics can only contain letters, numbers, hyphens, and underscores
    const topicRegex = /^[a-zA-Z0-9-_.~%]+$/;
    return topicRegex.test(topic);
}

/**
 * Sorts device tokens into ones FCM still accepts and ones it has dropped
 * (app uninstalled, token rotated). Each check is a dry run: FCM validates
 * the message and the token but delivers nothing, so phones are not woken.
 * If the first sends all fail for another reason (a bad key, say), it stops
 * and reports once instead of logging a line per token.
 */
export async function validateFCMTokens(tokens: string[]) {
    const validTokens: string[] = [];
    const invalidTokens: string[] = [];
    const fcm = messaging();
    if (!fcm) return { validTokens, invalidTokens };

    let otherFailures = 0;
    let firstFailure = '';
    for (const token of tokens) {
        try {
            await fcm.send({ data: { score: '850', time: '2:45' }, token }, true);
            validTokens.push(token);
        } catch (error: any) {
            const code = error?.errorInfo?.code || error?.code;
            if (TOKEN_GONE.has(code)) {
                invalidTokens.push(token);
                continue;
            }
            otherFailures++;
            if (!firstFailure) firstFailure = `${code}: ${error?.message}`;
            if (otherFailures >= 3 && validTokens.length === 0 && invalidTokens.length === 0) break;
        }
    }
    if (otherFailures) {
        console.error(`FCM token check: ${otherFailures} of ${tokens.length} checks failed for a reason other than the token (first: ${firstFailure}).`);
    }
    return { validTokens, invalidTokens };
}

const runTokenValidation = async () => {
    try {
        const tokenData = await AppFcmToken.findAll();
        const tokens = tokenData.map(token => token.fcmToken);
        const result = await validateFCMTokens(tokens);
        console.log(`FCM token check: ${result.validTokens.length} valid, ${result.invalidTokens.length} no longer registered.`);
        for (const token of result.invalidTokens) {
            await AppFcmToken.destroy({ where: { fcmToken: token } });
        }
    } catch (error) {
        console.error('FCM token check failed:', (error as Error).message);
    }
};

/**
 * Drops dead tokens at start-up and every 12 hours, as before, but only in a
 * running server with a key: never during `next build` (which imports this
 * module), and once per process however many bundles load it.
 */
function startTokenChecks() {
    const flags = globalThis as typeof globalThis & { __shathiFcmTokenChecks?: boolean };
    if (flags.__shathiFcmTokenChecks) return;
    if (process.env.NEXT_PHASE === 'phase-production-build') return;
    if (!messaging()) return;
    flags.__shathiFcmTokenChecks = true;
    runTokenValidation();
    setInterval(runTokenValidation, TOKEN_CHECK_EVERY_MS);
}

startTokenChecks();
