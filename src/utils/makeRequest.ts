import axios from "axios"
const baseUrl = "https://gen-doc.sandymoon.com.ng"

async function generateDocs (paths: Record<string, any>, config: Record<string, any>, id?: string){
    try {
        const res = await axios({
            method: 'post',
            data: {paths, config, ...(id && {id})},
            url: baseUrl+'/generate'
        })
        return res.data
    } catch (error: any) {
        throw error
    }
}

export {
   generateDocs
}


