import React from 'react';

const PrivacyPolicy = () => {
    return (
        <div style={{ fontFamily: 'Arial, sans-serif', lineHeight: '1.6', margin: '20px', padding: '20px', backgroundColor: '#f4f4f4' }}>
            <h1>Privacy Policy for Shathi App</h1>
            <p><strong>Last updated:</strong> October 1st, 2024</p>

            <p>At DigiGram Ventures, we are committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use the Shathi App, our investment and e-commerce platform designed to empower rural women farmers. Please read this policy carefully to understand our practices regarding your personal data and how we will treat it.</p>

            <h2>1. Information We Collect</h2>
            <p>We may collect and process the following types of information:</p>
            <ul>
                <li><strong>Personal Identification Information:</strong> When you register on our app, we collect details such as your name, email address, phone number, date of birth, and National ID (NID) card information (including front and back photos of the NID).</li>
                <li><strong>Financial Information:</strong> Information related to your investments, payments, and transactions within the app, including bank account details, transaction amounts, and history.</li>
                <li><strong>Profile Data:</strong> This includes your profile information such as your investment interests, your activity within the platform, and information about your projects and orders from Shathi Mart.</li>
                <li><strong>Biometric Data:</strong> A facial photo may be required during registration to verify your identity, especially during the KYC (Know Your Customer) process.</li>
                <li><strong>Device Information:</strong> We collect information about the device you use to access the app, such as device type, operating system, and IP address.</li>
            </ul>

            <h2>2. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul>
                <li><strong>Provide and Improve Our Services:</strong> This includes enabling you to invest in projects, shop from Shathi Mart, and interact with other users on the platform.</li>
                <li><strong>User Verification:</strong> To verify your identity using your NID and biometric data (such as a facial photo) during registration.</li>
                <li><strong>Payment Processing:</strong> To facilitate transactions, including investments and purchases within the app.</li>
                <li><strong>Marketing and Communications:</strong> With your consent, we may send you promotional offers, updates about new features, or marketing information related to your use of the app.</li>
                <li><strong>Compliance with Laws:</strong> To ensure that we comply with applicable laws and regulations, especially those related to financial transactions and investments.</li>
            </ul>

            <h2>3. How We Share Your Information</h2>
            <p>We may share your personal information in the following cases:</p>
            <ul>
                <li><strong>Third-party Service Providers:</strong> We may share your information with third parties that provide services such as payment processing, identity verification, and marketing on our behalf.</li>
                <li><strong>Legal Requirements:</strong> We may disclose your information to comply with legal obligations or respond to lawful requests, such as a court order, government inquiry, or other legal process.</li>
                <li><strong>Business Transfers:</strong> In the event of a merger, sale, or transfer of assets, your information may be transferred as part of the transaction.</li>
            </ul>

            <h2>4. Data Security</h2>
            <p>We implement appropriate technical and organizational measures to ensure the security of your personal data. These measures include data encryption, secure servers, and restricted access to sensitive information. However, please be aware that no system is completely secure, and we cannot guarantee the absolute security of your data.</p>

            <h2>5. Your Data Rights</h2>
            <p>You have the following rights regarding your personal data:</p>
            <ul>
                <li><strong>Access:</strong> You can request a copy of the personal data we hold about you.</li>
                <li><strong>Correction:</strong> You can request that we correct any inaccurate or incomplete information.</li>
                <li><strong>Deletion:</strong> You can request that we delete your personal data, subject to certain legal obligations.</li>
                <li><strong>Withdrawal of Consent:</strong> If we are processing your personal data based on your consent, you can withdraw that consent at any time.</li>
            </ul>
            <p>To exercise these rights, please contact us at [email].</p>

            <h2>6. Cookies and Tracking Technologies</h2>
            <p>We may use cookies and similar tracking technologies to collect information about your interactions with the app. This helps us improve user experience and analyze trends.</p>

            <h2>7. Third-party Links</h2>
            <p>Our app may contain links to third-party websites or services. We are not responsible for the privacy practices or the content of these third-party sites. Please review the privacy policies of any external sites before providing them with your information.</p>

            <h2>8. Changes to This Privacy Policy</h2>
            <p>We may update this Privacy Policy from time to time. Any changes will be posted on this page with an updated effective date. We encourage you to review this Privacy Policy periodically to stay informed about how we are protecting your information.</p>

            <h2>9. Contact Us</h2>
            <p>If you have any questions or concerns about this Privacy Policy, please contact us at:</p>
            <p><strong>DigiGram Ventures</strong><br />
                Email: support@digigramventures.com<br />
                Phone: +8801707247474
            </p>
        </div>
    );
}

export default PrivacyPolicy;

PrivacyPolicy.getLayout = function PageLayout(page: any) {
    return (
        <div>
            {page}
        </div>
    )
}