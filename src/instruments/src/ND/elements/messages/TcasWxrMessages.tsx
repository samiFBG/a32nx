import React, { FC, useState } from 'react';
import { Layer } from '@instruments/common/utils';
import { useSimVar } from '@instruments/common/simVars';
import { EfisSide, Mode, NdTraffic } from '@shared/NavigationDisplay';
import { useCoherentEvent } from '@instruments/common/hooks';

/*
Messages in priority order, from 1-12 (full set with ATSAW and nice weather radar)
[  TCAS (amber)   | WEATHER AHEAD (amber) ]
[  TCAS (amber)   |     ADS-B (amber)     ]
[  TCAS (amber)   |   ADS-B ONLY (white)  ]
[  TCAS (amber)   |                       ]
[   XX.YNM+NN^    |       XX.YNM+NN^      ]
[   XX.YNM+NN^    |     ADS-B (amber)     ]
[   XX.YNM+NN^    |                       ]
[ TA ONLY (white) | WEATHER AHEAD (amber) ]
[ TA ONLY (white) |     ADS-B (amber)     ]
[ TA ONLY (white) |                       ]
[                 |     ADS-B (amber)     ]
*/

interface TcasWxrMessage {
    text: string;
    color: 'White' | 'Amber' | 'Red';
}

export const TcasWxrMessages: FC<{ side: EfisSide, modeIndex: Mode, airTraffic: NdTraffic[] }> = ({ side, modeIndex, airTraffic }) => {
    // TODO get data and decide what to display

    let leftMessage: TcasWxrMessage | undefined;
    let rightMessage: TcasWxrMessage | undefined;

    const [tcasOnly] = useSimVar('L:A32NX_TCAS_TA_ONLY', 'boolean', 200);
    const [tcasFault] = useSimVar('L:A32NX_TCAS_FAULT', 'boolean', 200);
    const [offScreenL] = useSimVar(`L:A32NX_TCAS_${side}_OFF_SCREEN_L`, 'number', 200);
    const [offScreenR] = useSimVar(`L:A32NX_TCAS_${side}_OFF_SCREEN_R`, 'number', 200);

    const trafficL: NdTraffic | undefined = airTraffic.find((p) => p && parseInt(p.ID) === offScreenL);
    const trafficR: NdTraffic | undefined = airTraffic.find((p) => p && parseInt(p.ID) === offScreenR);

    if (tcasFault) {
        leftMessage = { text: 'TCAS', color: 'Amber' };
    } else if (airTraffic && trafficL && offScreenL !== -1) {
        leftMessage = { text: `${trafficL.hrzDistance.toFixed(2)}NM+${trafficL.relativeAlt}`, color: (trafficL.intrusionLevel === 3) ? 'Red' : 'Amber'};
    } else if (airTraffic && trafficR && offScreenR !== -1) {
        leftMessage = { text: `${trafficR.hrzDistance.toFixed(2)}NM+${trafficR.relativeAlt}`, color: (trafficR.intrusionLevel === 3) ? 'Red' : 'Amber'};
    } else if (tcasOnly) {
        leftMessage = { text: 'TA ONLY', color: 'White' };
    }

    if (trafficL && trafficR) {
        rightMessage = { text: `${trafficR.hrzDistance.toFixed(2)}NM+${trafficR.relativeAlt}`, color: (trafficR.intrusionLevel === 3) ? 'Red' : 'Amber'};
    }

    if (modeIndex !== Mode.ARC && modeIndex !== Mode.ROSE_NAV && modeIndex !== Mode.ROSE_VOR && modeIndex !== Mode.ROSE_ILS || (!leftMessage && !rightMessage)) {
        return null;
    }

    const y = (modeIndex === Mode.ROSE_VOR || modeIndex === Mode.ROSE_ILS) ? 713 : 684;

    return (
        <Layer x={164} y={y}>
            { /* we fill/mask the map under both message boxes, per IRL refs */ }
            { (modeIndex === Mode.ARC || modeIndex === Mode.ROSE_NAV) && (
                <rect x={0} y={0} width={440} height={59} className="BackgroundFill" stroke="none" />
            )}

            <rect x={0} y={0} width={440} height={30} className="White BackgroundFill" strokeWidth={1.75} />

            { (leftMessage) && (
                <text
                    x={8}
                    y={25}
                    className={`${leftMessage.color}`}
                    textAnchor="start"
                    fontSize={25}
                >
                    {leftMessage.text}
                </text>
            )}

            { (rightMessage) && (
                <text
                    x={425}
                    y={25}
                    className={`${rightMessage.color}`}
                    textAnchor="end"
                    fontSize={25}
                >
                    {rightMessage.text}
                </text>
            )}
        </Layer>
    );
};
