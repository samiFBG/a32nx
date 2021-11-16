/* eslint-disable camelcase */
import { useCoherentEvent } from '@instruments/common/hooks';
import { useSimVar } from '@instruments/common/simVars';
import React, { useEffect, FC, useState, memo } from 'react';
import { Layer } from '@instruments/common/utils';
import { TCAS_CONST as TCAS, TaRaIntrusion, TaRaIndex } from '@tcas/lib/TcasConstants';
import { Coordinates } from '@fmgc/flightplanning/data/geo';
import { MathUtils } from '@shared/MathUtils';
import { Mode } from '@shared/NavigationDisplay';
import { usePersistentProperty } from '@instruments/common/persistence';
import { MapParameters } from '../utils/MapParameters';

interface NDTraffic {
    alive?: boolean;
    ID: string;
    name: string;
    lat: number;
    lon: number;
    alt: number;
    relativeAlt: number;
    vertSpeed: number;
    heading: number;
    intrusionLevel: number;
    posX: number;
    posY: number;
    // debug
    seen?: number;
    hidden?: boolean;
    raTau?: number;
    taTau?: number;
    vTau?: number;
    closureRate?: number;
    closureAccel?: number;
}

export type TcasProps = {
    mapParams: MapParameters,
    mode: Mode.ARC | Mode.ROSE_NAV | Mode.ROSE_ILS | Mode.ROSE_VOR,
}

export const Traffic: FC<TcasProps> = ({ mode, mapParams }) => {
    const [airTraffic, setAirTraffic] = useState<NDTraffic[]>([]);
    const [latLong] = useState<Coordinates>({ lat: NaN, long: NaN });
    const [debug] = usePersistentProperty('TCAS_DEBUG', '0');
    const [sensitivity] = useSimVar('L:A32NX_TCAS_SENSITIVITY', 'number', 200);

    const mask: [number, number][] = (mode === Mode.ARC) ? [
        // ARC
        [-384, -310], [-384, 0], [-264, 0], [-210, 59], [-210, 185],
        [210, 185], [210, 0], [267, -61], [384, -61],
        [384, -310], [340, -355], [300, -390], [240, -431.5],
        [180, -460], [100, -482], [0, -492], [-100, -482],
        [-180, -460], [-240, -431.5], [-300, -390], [-340, -355],
        [-384, -310],
    ] : [
        // ROSE NAV
        [-340, -227], [-103, -227], [-50, -244],
        [0, -250], [50, -244], [103, -227], [340, -227],
        [340, 180], [267, 180], [210, 241], [210, 383],
        [-210, 383], [-210, 300], [-264, 241], [-340, 241], [-340, -227],
    ];
    const x: number = 361.5;
    const y: number = (mode === Mode.ARC) ? 606.5 : 368;

    useCoherentEvent('A32NX_TCAS_TRAFFIC', (aT: NDTraffic[]) => {
        airTraffic.forEach((traffic) => traffic.alive = false);
        aT.forEach((tf: NDTraffic) => {
            latLong.lat = tf.lat;
            latLong.long = tf.lon;
            let [x, y] = mapParams.coordinatesToXYy(latLong);

            // TODO FIXME: Full time option installed: For all ranges except in ZOOM ranges, NDRange > 9NM
            // TODO FIXME: Always show relative alt even in off-scale/half display
            if (!MathUtils.pointInPolygon(x, y, mask)) {
                const ret: [number, number] | null = MathUtils.intersectWithPolygon(x, y, 0, 0, mask);
                if (ret) [x, y] = ret;
            }
            tf.posX = x;
            tf.posY = y;

            const traffic: NDTraffic | undefined = airTraffic.find((p) => p && p.ID === tf.ID);
            if (traffic) {
                traffic.alive = true;
                traffic.alt = tf.alt;
                traffic.heading = tf.heading;
                traffic.intrusionLevel = tf.intrusionLevel;
                traffic.lat = tf.lat;
                traffic.lon = tf.lon;
                traffic.relativeAlt = tf.relativeAlt;
                traffic.vertSpeed = tf.vertSpeed;
                traffic.posX = tf.posX;
                traffic.posY = tf.posY;
                if (debug !== '0') {
                    traffic.hidden = tf.hidden;
                    traffic.seen = tf.seen;
                    traffic.raTau = tf.raTau;
                    traffic.taTau = tf.taTau;
                    traffic.vTau = tf.vTau;
                    traffic.closureAccel = tf.closureAccel;
                    traffic.closureRate = tf.closureRate;
                }
            } else {
                tf.alive = true;
                airTraffic.push(tf);
            }
        });
        setAirTraffic(airTraffic.filter((tf) => tf.alive));
    });

    if (debug !== '0') {
        const dmodRa: number = mapParams.nmToPx * (TCAS.DMOD[sensitivity || 1][TaRaIndex.RA]);
        const dmodTa: number = mapParams.nmToPx * (TCAS.DMOD[sensitivity || 1][TaRaIndex.TA]);
        return (
            <Layer x={x} y={y}>
                {dmodTa >= 0
                && (
                    <path
                        d={`M 22.5, 16 m -${dmodTa}, 0 a ${dmodTa},${dmodTa} 0 1,0 ${dmodTa * 2},0 a ${dmodTa},${dmodTa} 0 1,0 -${dmodTa * 2},0`}
                        strokeWidth={2}
                        className="Amber"
                        strokeDasharray="5 2.5"
                    />
                )}
                {dmodRa >= 0
                && (
                    <path
                        d={`M 22.5, 16 m -${dmodRa}, 0 a ${dmodRa},${dmodRa} 0 1,0 ${dmodRa * 2},0 a ${dmodRa},${dmodRa} 0 1,0 -${dmodRa * 2},0`}
                        strokeWidth={2}
                        className="Red"
                        strokeDasharray="6 3"
                    />
                )}
                <text x={290} y={-200} fill="#ffffff" fontSize="12px" height={1.25} strokeWidth={0.3} textAnchor="middle" xmlSpace="preserve">
                    <tspan fill="#ffffff">
                        {`Sensitivity: ${sensitivity}`}
                    </tspan>
                    <tspan x={290} dy={15} fill="#ffffff">
                        {'DMOD: '}
                    </tspan>
                    <tspan fill="#e38c56">
                        {dmodTa}
                    </tspan>
                    <tspan fill="#ffffff">
                        {' | '}
                    </tspan>
                    <tspan fill="#ff0000">
                        {dmodRa}
                    </tspan>
                    <tspan x={290} dy={15} fill="#ffffff">
                        {'TAU THR: '}
                    </tspan>
                    <tspan fill="#e38c56">
                        {TCAS.TAU[sensitivity || 1][TaRaIndex.TA]}
                    </tspan>
                    <tspan fill="#ffffff">
                        {' | '}
                    </tspan>
                    <tspan fill="#ff0000">
                        {TCAS.TAU[sensitivity || 1][TaRaIndex.RA]}
                    </tspan>

                    <tspan x={290} dy={15} fill="#ffffff">
                        {'Z THR: '}
                    </tspan>
                    <tspan fill="#e38c56">
                        {TCAS.ZTHR[sensitivity || 1][TaRaIndex.TA]}
                    </tspan>
                    <tspan fill="#ffffff">
                        {' | '}
                    </tspan>
                    <tspan fill="#ff0000">
                        {TCAS.ZTHR[sensitivity || 1][TaRaIndex.RA]}
                    </tspan>

                    <tspan x={290} dy={15} fill="#ffffff">
                        {'ALIM: '}
                    </tspan>
                    <tspan fill="#ff0000">
                        {TCAS.ALIM[sensitivity]}
                    </tspan>
                </text>
                {airTraffic.map((tf) => (
                    <TrafficIndicatorDebug
                        key={tf.ID}
                        x={tf.posX}
                        y={tf.posY}
                        relativeAlt={tf.relativeAlt}
                        vertSpeed={tf.vertSpeed}
                        intrusionLevel={tf.intrusionLevel}
                        ID={tf.ID}
                        hidden={tf.hidden}
                        seen={tf.seen}
                        raTau={tf.raTau < 200 ? tf.raTau?.toFixed(0) : undefined}
                        taTau={tf.taTau < 200 ? tf.taTau?.toFixed(0) : undefined}
                        vTau={tf.vTau < 200 ? tf.vTau?.toFixed(0) : undefined}
                        closureAccel={tf.closureAccel?.toFixed(1)}
                        closureRate={tf.closureRate?.toFixed(1)}

                    />
                ))}
            </Layer>
        );
    }
    return (
        <Layer x={x} y={y}>
            {airTraffic.map((tf) => (
                <TrafficIndicator
                    key={tf.ID}
                    x={tf.posX}
                    y={tf.posY}
                    relativeAlt={tf.relativeAlt}
                    vertSpeed={tf.vertSpeed}
                    intrusionLevel={tf.intrusionLevel}
                />
            ))}
        </Layer>
    );
};

type TrafficProp = {
    x: number,
    y: number,
    relativeAlt: number,
    vertSpeed: number,
    intrusionLevel: TaRaIntrusion,
}

const TrafficIndicator: FC<TrafficProp> = memo(({ x, y, relativeAlt, vertSpeed, intrusionLevel }) => {
    let color = '#ffffff';
    switch (intrusionLevel) {
    case TaRaIntrusion.TA:
        color = '#e38c56';
        break;
    case TaRaIntrusion.RA:
        color = '#ff0000';
        break;
    default:
        break;
    }

    // Place relative altitude above/below
    const relAltY: number = (relativeAlt > 0) ? 3.708355 : 43.708355;

    return (
        <>
            <Layer x={x} y={y}>
                {intrusionLevel === TaRaIntrusion.TRAFFIC && <image x={0} y={0} width={45} height={32} xlinkHref="/Images/ND/TRAFFIC_NORMAL.svg" />}
                {intrusionLevel === TaRaIntrusion.PROXIMITY && <image x={0} y={0} width={45} height={32} xlinkHref="/Images/ND/TRAFFIC_PROXIMITY.svg" />}
                {intrusionLevel === TaRaIntrusion.TA && <image x={0} y={0} width={45} height={32} xlinkHref="/Images/ND/TRAFFIC_TA.svg" />}
                {intrusionLevel === TaRaIntrusion.RA && <image x={0} y={0} width={45} height={32} xlinkHref="/Images/ND/TRAFFIC_RA.svg" />}
                <g>
                    <text x={30} y={relAltY} fill={color} height={1.25} strokeWidth={0.3} textAnchor="end" xmlSpace="preserve">
                        <tspan x={17.25} y={relAltY} fill={color} fontSize="20px" strokeWidth={0.3} textAnchor="middle">
                            {`${relativeAlt > 0 ? '+' : '-'}${Math.abs(relativeAlt) < 10 ? '0' : ''}${Math.abs(relativeAlt)}`}
                        </tspan>
                    </text>
                    {(vertSpeed <= -500) && (
                        <>
                            <path fill="none" stroke={color} strokeWidth={2.75} d="M38.3,24V6.6" />
                            <path fill={color} stroke="none" fillRule="evenodd" d="M34,18l3.8,9.6h1l3.8-9.6H34z" />
                        </>
                    )}
                    {(vertSpeed >= 500) && (
                        <>
                            <path fill="none" stroke={color} strokeWidth={2.75} d="M38.3,9.5v17.4" />
                            <path fill={color} stroke="none" fillRule="evenodd" d="M42.6,15.5l-3.8-9.6h-1L34,15.5H42.6z" />
                        </>
                    )}
                </g>
            </Layer>
        </>
    );
});

type TrafficPropDebug = {
    x: number,
    y: number,
    relativeAlt: number,
    vertSpeed: number,
    intrusionLevel: TaRaIntrusion,
    ID: number,
    hidden: boolean | undefined,
    seen: number | undefined,
    raTau: string | undefined,
    taTau: string | undefined,
    vTau: string | undefined,
    closureRate: string | undefined,
    closureAccel: string | undefined
}

const TrafficIndicatorDebug: FC<TrafficPropDebug> = memo(({ x, y, relativeAlt, vertSpeed, intrusionLevel, ID, hidden, seen, raTau, taTau, vTau, closureRate, closureAccel }) => {
    let color = '#ffffff';
    switch (intrusionLevel) {
    case TaRaIntrusion.TA:
        color = '#e38c56';
        break;
    case TaRaIntrusion.RA:
        color = '#ff0000';
        break;
    default:
        break;
    }

    // Place relative altitude above/below
    const relAltY: number = (relativeAlt > 0) ? 3.708355 : 43.708355;
    const debugY1: number = (relativeAlt > 0) ? 38 : -1;
    const debugY2: number = (relativeAlt > 0) ? 50 : -13;

    return (
        <>
            <Layer x={x} y={y}>
                {intrusionLevel === TaRaIntrusion.TRAFFIC && <image opacity={hidden ? 0.125 : 1.0} x={0} y={0} width={45} height={32} xlinkHref="/Images/ND/TRAFFIC_NORMAL.svg" />}
                {intrusionLevel === TaRaIntrusion.PROXIMITY && <image opacity={hidden ? 0.125 : 1.0} x={0} y={0} width={45} height={32} xlinkHref="/Images/ND/TRAFFIC_PROXIMITY.svg" />}
                {intrusionLevel === TaRaIntrusion.TA && <image opacity={hidden ? 0.125 : 1.0} x={0} y={0} width={45} height={32} xlinkHref="/Images/ND/TRAFFIC_TA.svg" />}
                {intrusionLevel === TaRaIntrusion.RA && <image opacity={hidden ? 0.125 : 1.0} x={0} y={0} width={45} height={32} xlinkHref="/Images/ND/TRAFFIC_RA.svg" />}
                <g>
                    <text x="30" y={relAltY} fillOpacity={hidden ? 0.125 : 1} fill={color} height={1.25} strokeWidth={0.3} textAnchor="end" xmlSpace="preserve">
                        <tspan x="15.4" y={relAltY} fill={color} fontSize="20px" strokeWidth={0.3} textAnchor="middle">
                            {`${relativeAlt > 0 ? '+' : '-'}${Math.abs(relativeAlt) < 10 ? '0' : ''}${Math.abs(relativeAlt)}`}
                        </tspan>
                        {!hidden && (
                            <>
                                <tspan x="15.4" y={debugY1} fillOpacity={0.6} fill={color} fontSize="8px" strokeWidth={0.2} textAnchor="middle">
                                    {`${ID} [${closureRate}|${closureAccel}] <${seen}>`}
                                </tspan>
                                <tspan x="15.4" y={debugY2} fill={color} fontSize="12px" strokeWidth={0.2} textAnchor="middle">
                                    {`R ${raTau || '-'} V ${vTau || '-'} T ${taTau || '-'}`}
                                </tspan>
                            </>
                        )}
                    </text>
                    {(vertSpeed <= -500) && (
                        <>
                            <path opacity={hidden ? 0.125 : 1} fill="none" stroke={color} strokeWidth={2.75} d="M38.3,24V6.6" />
                            <path opacity={hidden ? 0.125 : 1} fill={color} stroke="none" fillRule="evenodd" d="M34,18l3.8,9.6h1l3.8-9.6H34z" />
                        </>
                    )}
                    {(vertSpeed >= 500) && (
                        <>
                            <path opacity={hidden ? 0.125 : 1} fill="none" stroke={color} strokeWidth={2.75} d="M38.3,9.5v17.4" />
                            <path opacity={hidden ? 0.125 : 1} fill={color} stroke="none" fillRule="evenodd" d="M42.6,15.5l-3.8-9.6h-1L34,15.5H42.6z" />
                        </>
                    )}
                </g>
            </Layer>
        </>
    );
});
