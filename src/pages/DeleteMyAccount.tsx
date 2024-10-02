import { useState } from 'react';
import { Phone } from 'lucide-react';

export default function DeletionRequestForm() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    // Here you would typically send the request to your backend
    setIsSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-center mb-6">
          <Phone className="h-12 w-12 text-blue-500" />
        </div>
        <h1 className="text-2xl font-bold text-center mb-4">
          Account Deletion Request
        </h1>
        <p className="text-gray-600 text-center mb-6">
          Enter your phone number to request deletion of your account and associated data from Google Play Store
        </p>
        
        {!isSubmitted ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                id="phone"
                placeholder="+1 (555) 555-5555"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 transition-colors"
            >
              Submit Deletion Request
            </button>
          </form>
        ) : (
          <div className="text-center">
            <h2 className="text-xl font-semibold text-green-600 mb-2">Request Submitted!</h2>
            <p className="text-gray-600">
              We've received your deletion request. We'll process it and send a confirmation to your phone number.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
