import admin from 'firebase-admin';
import serviceAccount from './firebase.json';

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
});

const sendNotif = async (to: string, title: string, body: string) => {
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
                // sound: "default",
                // imageUrl: "https://example.com/image.jpg",
            },
        },
    };

    try {
        const response = await admin.messaging().send(message);
        console.log((new Date()).toISOString() + ' Mobile notification:', to, response);
        return response;
    } catch (error: any) {
        console.error("____" + (new Date()).toISOString() + " " + 'Mobile notification error:', to, error.errorInfo);
    }
};

export async function sendNotificationToTopic(topic: string, title: string, body: string, data = {}) {
    console.log('Sending notification to topic:', topic);
    try {
        // Validate topic name (Firebase has specific requirements for topic names)
        if (!isValidTopicName(topic)) {
            throw new Error('Invalid topic name. Must only contain letters, numbers, hyphens, and underscores.');
        }

        // Construct the message
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
            topic: topic // Specify the topic
        };

        // Send the message
        const response = await admin.messaging().send(message as admin.messaging.Message);
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

// sendNotif("____" + (new Date()).toISOString() + " " + 'Hello', 'How are you doing', "c4NASXquQGi-tlj3-41Z3_:APA91bGT3qaL9FFg5xPLDDDCf7CIrIK1ldzJBD_LpNAv0Ndu9l7Su6V7q426gz1nPi-FsbIBinfD_BtVBxyLU97tRWBE1XvxwbBLJjkV9AAbNqwm9NdeQ5bCT9sSPI5xjUsSlNaIZ-N6");
export default sendNotif;