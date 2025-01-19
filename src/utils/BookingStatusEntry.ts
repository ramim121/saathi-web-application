import ProjectInvestmentBookingStatus from "@/models/ProjectInvestmentBookingStatus";

async function BookingStatusEntry(
    status: string,
    idProjectInvestmentBookings: number,
    idUsers: number,
    remarks: string,
    transaction: any // Reuse the same transaction
) {
    try {
        const bookingStatus = await ProjectInvestmentBookingStatus.create({
            status,
            idProjectInvestmentBookings,
            idUsers,
            remarks
        }, { transaction });
        return bookingStatus;
    } catch (err) {
        throw new Error(err instanceof Error ? err.message : String(err));
    }
}

export default BookingStatusEntry;
