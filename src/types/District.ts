import { Optional } from 'sequelize';

export default interface District {
    idDistricts: number;
    idDivisions: number;
    name: string;
    bnName: string;
    lat: Number | null;
    lon: Number | null;
    url: string;
}

export interface DistrictAttributes extends Optional<District, 'idDistricts'> { }
