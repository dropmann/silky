import type { AuxEntry } from '../../types';
import ModulesAuxView from './view';
import './style.css';

const entry: AuxEntry = {
    id: 'modules',
    order: 140,
    create: ({ t, instance }) => new ModulesAuxView(t, instance),
};

export default entry;
