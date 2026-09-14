import React, { useState, useEffect } from 'react';

export default function PracticeResources({ initialResource = 'equipment', onMarkDone, t }) {
    const [activeResource, setActiveResource] = useState(initialResource);

    useEffect(() => {
        setActiveResource(initialResource);
    }, [initialResource]);

    const resourceDetails = {
        equipment: {
            title: t('practice.res.equipmentTitle', 'Equipment readiness'),
            desc: t('practice.res.equipmentDesc', 'Check operational status and calibration before use. Viewing an asset does not book or calibrate it.')
        },
        inventory: {
            title: t('practice.res.inventoryTitle', 'Choose the right lot'),
            desc: t('practice.res.inventoryDesc', 'Check quantity, expiry, status and storage location. An inventory view is not a stock consumption record.')
        },
        kobo: {
            title: t('practice.res.koboTitle', 'Preserve the field connection'),
            desc: t('practice.res.koboDesc', 'Look for source form, field identifier and location provenance. Configured connectivity does not prove a successful import or receipt.')
        },
        sis: {
            title: t('practice.res.sisTitle', 'Exchange with a clear status'),
            desc: t('practice.res.sisDesc', 'Review the allowed dataset and its metadata. A payload preview does not prove delivery or acknowledgement by a national SIS.')
        }
    };

    const handleClick = (key) => {
        setActiveResource(key);
        onMarkDone();
    };

    const current = resourceDetails[activeResource] || resourceDetails.equipment;

    return (
        <>
            <div className="split">
                <button
                    type="button"
                    className="path"
                    data-resource="equipment"
                    onClick={() => handleClick('equipment')}
                >
                    <span>{t('practice.res.btnEquipment', 'Equipment')}<small>{t('practice.res.btnEquipmentSub', 'Readiness & calibration')}</small></span>↗
                </button>
                <button
                    type="button"
                    className="path"
                    data-resource="inventory"
                    onClick={() => handleClick('inventory')}
                >
                    <span>{t('practice.res.btnInventory', 'Inventory')}<small>{t('practice.res.btnInventorySub', 'Lots, expiry & storage')}</small></span>↗
                </button>
                <button
                    type="button"
                    className="path"
                    data-resource="kobo"
                    onClick={() => handleClick('kobo')}
                >
                    <span>{t('practice.res.btnKobo', 'Kobo')}<small>{t('practice.res.btnKoboSub', 'Field provenance')}</small></span>↗
                </button>
                <button
                    type="button"
                    className="path"
                    data-resource="sis"
                    onClick={() => handleClick('sis')}
                >
                    <span>{t('practice.res.btnSis', 'SIS')}<small>{t('practice.res.btnSisSub', 'Authorized exchange')}</small></span>↗
                </button>
            </div>

            <div id="resourceInfo" className="panel focus">
                <h3>{current.title}</h3>
                <p className="small muted">{current.desc}</p>
            </div>

            <div className="panel">
                <h3>{t('practice.res.langTitle', 'Use your language.')}</h3>
                <p className="small muted">
                    {t('practice.res.langDesc', "The implementation follows the platform's five language options.")}
                </p>
                <div className="language-list">
                    <span>English</span>
                    <span>Español</span>
                    <span>Español · América Latina</span>
                    <span>Français</span>
                    <span>Português</span>
                </div>
            </div>
        </>
    );
}
