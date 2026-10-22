import type { AuxEntry } from '../../types';
import ModulesAuxView from './view';
import './style.css';

const entry: AuxEntry = {
    id: 'modules',
    order: 140,
    create: ({ instance }) => new ModulesAuxView(instance),
};

export default entry;
