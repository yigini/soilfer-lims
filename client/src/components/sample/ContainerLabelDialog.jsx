import React from 'react';
import LabelPrintDialog from '../common/LabelPrintDialog';

export default function ContainerLabelDialog({ container, onClose }) {
    return <LabelPrintDialog isOpen container={container} onClose={onClose} />;
}
