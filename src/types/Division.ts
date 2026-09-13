import { Optional } from 'sequelize';

export default interface Division {
    idDivisions: number;
    name: string;
    bnName: string;
    url: string;
}

export interface DivisionAttributes extends Optional<Division, 'idDivisions'> { }