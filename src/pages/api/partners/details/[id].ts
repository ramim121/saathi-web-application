import { NextApiRequest, NextApiResponse } from 'next';
import { User, File, ProjectPartner, Project, ProjectPartnerInvestor, ProjectInvestor, ProjectInvestmentBooking, PartnerAdditionalInfo } from '@/models/__associations';
import sequelize from '@/config/db';
import { withCors, readAuth } from '@/utils/auth';

/**
 * A partner's profile and the projects they still have room on.
 *
 * SECURITY: this route is public — the app's Affiliated Project screen calls
 * it — and it returned the full user row of ANY id, investors included
 * (phone, date of birth, NID image names…), plus, through each partnership,
 * the investors' booking rows (amounts, transaction ids, proof-of-payment file
 * names). Now:
 *   - an admin token gets the full record, as the admin partner pages need;
 *   - everyone else gets partners only, their public profile fields (the
 *     same set the public project route shows), and each partnership's
 *     project — which is all the app reads (`data.Partnerships[].Project`).
 */

/** The partner fields the public project route already shows. */
const PUBLIC_PARTNER_FIELDS = [
    'idUsers', 'fullName', 'role', 'location', 'interestedIn', 'disability', 'joiningDate', 'age', 'skills', 'bio',
    'fullNameBn', 'roleBn', 'locationBn', 'interestedInBn', 'skillsBn', 'bioBn',
];

const roomLeft = sequelize.literal(`partner_unit_capacity > (
    SELECT IFNULL(SUM(invested_unit),0)
    FROM project_partner_investors AS ppi
    LEFT JOIN project_investors AS pi ON pi.id_project_investors = ppi.id_project_investors
    WHERE ppi.id_project_partners = Partnerships.id_project_partners
    AND pi.investment_status = "confirmed"
)`);

const investedUnits: [ReturnType<typeof sequelize.literal>, string] = [
    sequelize.literal(`(
        SELECT IFNULL(SUM(invested_unit),0)
        FROM project_partner_investors AS ppi
        LEFT JOIN project_investors AS pi ON pi.id_project_investors = ppi.id_project_investors
        WHERE ppi.id_project_partners = Partnerships.id_project_partners
        AND pi.investment_status = 'confirmed'
    )`),
    'alreadyInvestedUnits'
];

async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    if (req.method === 'GET') {
        const admin = readAuth(req)?.userType === 'admin';
        try {
            const result = admin
                ? await User.findOne({
                    where: {
                        idUsers: req.query.id
                    },
                    include: [
                        { model: File, as: 'ProfilePicture' },
                        { model: File, as: 'FeaturedImages' },
                        { model: PartnerAdditionalInfo, as: 'PartnerAdditionalInfo' },
                        {
                            model: ProjectPartner, as: 'Partnerships',
                            attributes: ['partnerUnitCapacity', investedUnits],
                            include: [
                                {
                                    model: Project, as: 'Project',
                                    where: { projectStatus: 'created' },
                                    include: [
                                        { model: File, as: 'MainImage' },
                                        { model: File, as: 'FeaturedImages' }]
                                },
                                {
                                    model: ProjectPartnerInvestor,
                                    required: false,
                                    include: [
                                        {
                                            model: ProjectInvestor,
                                            include: [
                                                { model: ProjectInvestmentBooking }
                                            ]
                                        }
                                    ]
                                }
                            ],
                            where: roomLeft,
                            required: false
                        }
                    ],
                })
                : await User.findOne({
                    where: {
                        idUsers: req.query.id,
                        userType: 'partner'
                    },
                    attributes: PUBLIC_PARTNER_FIELDS,
                    include: [
                        { model: File, as: 'ProfilePicture' },
                        { model: File, as: 'FeaturedImages' },
                        {
                            model: ProjectPartner, as: 'Partnerships',
                            attributes: ['partnerUnitCapacity', investedUnits],
                            include: [
                                {
                                    model: Project, as: 'Project',
                                    where: { projectStatus: 'created' },
                                    include: [
                                        { model: File, as: 'MainImage' },
                                        { model: File, as: 'FeaturedImages' }]
                                }
                            ],
                            where: roomLeft,
                            required: false
                        }
                    ],
                });

            return res.status(200).json({ success: true, data: result });
        } catch (error) {
            return res.status(400).json({ success: false, message: (error as Error).message })
        }
    } else {
        res.status(405).json({ success: false, message: 'Method not allowed' })
    }
}

export default withCors(handler);
