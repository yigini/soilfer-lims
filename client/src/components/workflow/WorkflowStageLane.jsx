import React from 'react';
import WorkflowStageCard from './WorkflowStageCard';

/**
 * V2 T03: Stage Lane — renders 7 fixed stage cards in a visual flow.
 *
 * Layout (2 rows):
 *  Row 1: Reception → Prep → Physical → Chemical → Spectral
 *  Row 2: (centered)                    QA → Archive
 */
export default function WorkflowStageLane({
    stageSummaries,
    path,
    onStageClick,
}) {
    if (!stageSummaries || stageSummaries.length === 0) return null;

    const { completedRooms, currentRoom, futureRooms } = path || {};

    const getPhase = (room) => {
        if (room === currentRoom) return 'current';
        if (completedRooms?.includes(room)) return 'completed';
        if (futureRooms?.includes(room)) return 'future';
        return 'future';
    };

    const connectorClass = (fromRoom, toRoom) => {
        const fromPhase = getPhase(fromRoom);
        const toPhase = getPhase(toRoom);
        if (fromPhase === 'completed' && (toPhase === 'completed' || toPhase === 'current')) return 'completed';
        if (fromPhase === 'current') return 'current';
        return 'future';
    };

    // Map rooms to stage summaries
    const stageMap = {};
    stageSummaries.forEach(s => { stageMap[s.room] = s; });

    const renderCard = (room) => {
        const stage = stageMap[room];
        if (!stage) return null;
        return (
            <WorkflowStageCard
                key={room}
                stage={stage}
                isCurrent={room === currentRoom}
                isCompleted={completedRooms?.includes(room)}
                isFuture={futureRooms?.includes(room)}
                onClick={onStageClick}
            />
        );
    };

    const renderConnector = (fromRoom, toRoom) => (
        <div key={`c-${fromRoom}-${toRoom}`} className={`wf-connector ${connectorClass(fromRoom, toRoom)}`} />
    );

    // Row 1: Reception → Prep → Physical → Chemical → Spectral
    const row1Rooms = ['Reception', 'Preparation Room', 'Physical Testing', 'Chemical Analysis', 'Spectral Lab'];
    // Row 2: QA → Archive (centered)
    const row2Rooms = ['QA Review', 'Archive & Disposal'];

    return (
        <div className="wf-stage-lane" role="region" aria-label="Workflow stage lane">
            {/* Row 1 */}
            <div className="wf-lane-row">
                {row1Rooms.map((room, i) => (
                    <React.Fragment key={room}>
                        {i > 0 && renderConnector(row1Rooms[i - 1], room)}
                        {renderCard(room)}
                    </React.Fragment>
                ))}
            </div>

            {/* Vertical connector hint from labs to QA */}
            <div style={{ display: 'flex', justifyContent: 'center', width: '100%', maxWidth: 1400 }}>
                <div style={{ width: 2, height: 20, background: `${getPhase('QA Review') === 'future' ? '#e2e8f0' : '#86efac'}`, borderRadius: 1 }} />
            </div>

            {/* Row 2 */}
            <div className="wf-lane-row" style={{ justifyContent: 'center' }}>
                {row2Rooms.map((room, i) => (
                    <React.Fragment key={room}>
                        {i > 0 && renderConnector(row2Rooms[i - 1], room)}
                        {renderCard(room)}
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
}
