import React from 'react';
import { HelpTooltip } from './HelpTooltip';

/**
 * InfoTooltip wrapper delegating to accessible HelpTooltip component.
 * Retains backwards compatibility for all legacy call sites.
 */
const InfoTooltip = ({ text, position = 'bottom', className = '' }) => {
    return <HelpTooltip text={text} position={position} className={className} />;
};

export default InfoTooltip;
