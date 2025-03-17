import { Optional } from 'sequelize';

export default interface PoliceStation {
    idPoliceStations: number;
    idDistricts: number;
    name: string;
    bnName: string;
    url: string;
}

export interface PoliceStationAttributes extends Optional<PoliceStation, 'idPoliceStations'> { }