import { Optional } from 'sequelize';

export default interface InvestorTestimonial {
    idInvestorTestimonials: number;
    name: string;
    image: string;
    rating: number;
    testimonial: Text;
    // Bangla counterparts (migration 002); null falls back to English.
    nameBn?: string | null;
    testimonialBn?: string | null;
    priority: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface InvestorTestimonialAttributes extends Optional<InvestorTestimonial, 'idInvestorTestimonials'> { }