const cluster = require('node:cluster');
const app = require('./app');
const numCpus = require('node:os').availableParallelism();


if(cluster.isPrimary){
    console.log(`Primary ${process.pid} is running...`);

    for (let i = 1; i <= numCpus; i++) {
        cluster.fork();
    }
    
    cluster.on('exit', (worker)=>{
        console.log(`Worker ${worker.process.pid} died`);
    })
}else{
    app.listen(3750, ()=>{
        console.log(`App started listening port on 3750 with worker ${process.pid}`);
    })
}