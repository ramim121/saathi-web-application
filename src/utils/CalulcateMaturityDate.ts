
// Define the allowed tenure types
type TenureType = 'months' | 'years';

// Define the return type for the formatted maturity date
interface MaturityDateResult {
    investmentDate: string;
    maturityDate: string;
    maturityDateFormatted: string;
}

export function calculateMaturityDate(
    investmentDate: string | Date, 
    investmentDuration: number, 
    tenureType: TenureType
): Date {
    // Parse the investment date string
    const startDate = new Date(investmentDate);

    // Check if the date is valid
    if (isNaN(startDate.getTime())) {
        throw new Error('Invalid investment date');
    }

    // Create a new date object for maturity calculation
    const maturityDate = new Date(startDate);

    // Add duration based on tenure type
    if (tenureType === 'months') {
        maturityDate.setMonth(maturityDate.getMonth() + investmentDuration);
    } else if (tenureType === 'years') {
        maturityDate.setFullYear(maturityDate.getFullYear() + investmentDuration);
    } else {
        throw new Error('Invalid tenure type. Must be "months" or "years"');
    }

    return maturityDate;
}

// Helper function to format date nicely
export function formatMaturityDate(
    investmentDate: string | Date, 
    investmentDuration: number, 
    tenureType: TenureType
): MaturityDateResult {
    const maturity = calculateMaturityDate(investmentDate, investmentDuration, tenureType);
    return {
        investmentDate: typeof investmentDate === 'string' ? investmentDate : investmentDate.toISOString().split('T')[0],
        maturityDate: maturity.toISOString().split('T')[0],
        maturityDateFormatted: maturity.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        })
    };
}