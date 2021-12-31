import * as React from 'react'
import { Link } from "react-router-dom";


export default function DefaultPage(){
    return (<div>
        default page
        <Link to="/generate-alarm">generate-alarm</Link>

    </div>)
}