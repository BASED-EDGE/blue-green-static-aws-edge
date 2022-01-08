import * as React from 'react'
import {postErrorMetric} from './common'

export default function GenerateAlarm(){
    return (<div>
        generate alarm page
        <button onClick={() => { postErrorMetric(true) }}>click to generate error metric to induce rollback during deployment</button>
    </div>)
}