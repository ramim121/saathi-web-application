import ProjectInvestorStatus from "@/models/ProjectInvestorStatus";

async function ProjectInvestorStatusEntry(
    status: string,
    idProjectInvestors: number,
    idUsers: number,
    remarks: string,
    transaction: any // Reuse the same transaction
) {
    try {
        const investorStatus = await ProjectInvestorStatus.create({
            status,
            idProjectInvestors,
            idUsers,
            remarks
        }, { transaction });
        return investorStatus;
    } catch (err) {
        throw new Error(err instanceof Error ? err.message : String(err));
    }
}

export default ProjectInvestorStatusEntry;
