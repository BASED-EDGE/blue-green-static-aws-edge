const fs = require('fs/promises')


async function main(){
   try{
        await fs.access('./dist')
    }catch{
        await fs.mkdir('./dist')
    }
    const crypto = require("crypto");

    const id = crypto.randomBytes(16).toString("hex");
    fs.writeFile('./dist/build_id',id)

}

main()