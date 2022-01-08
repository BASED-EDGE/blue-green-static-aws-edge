import * as React from 'react'
import { Link } from 'react-router-dom'
import {postErrorMetric} from './common'


export default function DefaultPage(){
    React.useEffect(() => {
        postErrorMetric(false)
    }, [])
    
    return (<div>
        default page
        <Link to="/generate-alarm">generate-alarm</Link>
    </div>)
}