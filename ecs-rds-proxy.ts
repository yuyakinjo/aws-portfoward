import * as inquirer from 'inquirer';
import * as net from 'net';
import { spawn, execSync } from 'child_process';

async function main() {
  // Select AWS region
  const regionsJson = execSync('aws ec2 describe-regions --query "Regions[].RegionName" --output json', { encoding: 'utf-8' });
  const regions: string[] = JSON.parse(regionsJson);
  const { region } = await inquirer.prompt<{ region: string }>([
    { type: 'list', name: 'region', message: 'Select AWS region', choices: regions }
  ]);

  // Select ECS cluster
  const clustersJson = execSync(`aws ecs list-clusters --region ${region} --output json`, { encoding: 'utf-8' });
  const clusterArns: string[] = JSON.parse(clustersJson).clusterArns;
  const clusterNames = clusterArns.map(arn => arn.split('/').pop()!);
  const { cluster } = await inquirer.prompt<{ cluster: string }>([
    { type: 'list', name: 'cluster', message: 'Select ECS cluster', choices: clusterNames }
  ]);

  // Select ECS task
  const tasksJson = execSync(`aws ecs list-tasks --region ${region} --cluster ${cluster} --output json`, { encoding: 'utf-8' });
  const taskArns: string[] = JSON.parse(tasksJson).taskArns;
  let task: string;
  if (taskArns.length === 0) {
    console.error('No running tasks found in cluster:', cluster);
    process.exit(1);
  } else if (taskArns.length === 1) {
    task = taskArns[0].split('/').pop()!;
    console.log('Using sole task:', task);
  } else {
    const taskChoices = taskArns.map(arn => arn.split('/').pop()!);
    ({ task } = await inquirer.prompt<{ task: string }>([
      { type: 'list', name: 'task', message: 'Select ECS task', choices: taskChoices }
    ]));
  }

  // Select RDS instance
  const rdsJson = execSync(`aws rds describe-db-instances --region ${region} --output json`, { encoding: 'utf-8' });
  const dbInstances = JSON.parse(rdsJson).DBInstances as any[];
  if (dbInstances.length === 0) {
    console.error('No RDS instances found in region:', region);
    process.exit(1);
  }
  const rdsChoices = dbInstances.map(db => ({
    name: `${db.DBInstanceIdentifier} (${db.Endpoint.Address}:${db.Endpoint.Port})`,
    value: { host: db.Endpoint.Address, port: db.Endpoint.Port }
  }));
  const { rds } = await inquirer.prompt<{ rds: { host: string; port: number } }>([
    { type: 'list', name: 'rds', message: 'Select RDS instance', choices: rdsChoices }
  ]);

  // DB credentials
  const { username, password, database } = await inquirer.prompt<{
    username: string;
    password: string;
    database: string;
  }>([
    { type: 'input', name: 'username', message: 'Database username' },
    { type: 'password', name: 'password', message: 'Database password', mask: '*' },
    { type: 'input', name: 'database', message: 'Database name' }
  ]);

  // Local port
  const { localPort } = await inquirer.prompt<{ localPort: number }>([
    { type: 'number', name: 'localPort', message: 'Local port', default: 8888 }
  ]);

  // Build ECS exec command
  const containerName = 'bastion';
  const ecsCommand = `socat STDIO TCP:${rds.host}:${rds.port}`;
  const awsArgs = [
    'ecs', 'execute-command',
    '--region', region,
    '--cluster', cluster,
    '--task', task,
    '--container', containerName,
    '--interactive',
    '--command', ecsCommand
  ];
  console.log(`Running: aws ${awsArgs.join(' ')}`);

  const ecsProc = spawn('aws', awsArgs, { stdio: ['pipe', 'pipe', 'inherit'] });
  ecsProc.on('error', err => {
    console.error('Failed to start ECS exec:', err);
    process.exit(1);
  });

  const server = net.createServer(socket => {
    console.log(`Local client connected on port ${localPort}`);
    // Optionally, you could start a DB client process here using exec/spawn
    socket.pipe(ecsProc.stdin);
    ecsProc.stdout.pipe(socket);
    socket.on('close', () => {
      console.log('Connection closed');
      server.close();
    });
  });
  server.listen(localPort, '127.0.0.1', () => console.log(`Forwarding localhost:${localPort} -> ECS container -> RDS (${rds.host}:${rds.port})`));

  ecsProc.on('close', (code, signal) => {
    console.log(`ECS exec process closed (code=${code}, signal=${signal})`);
    server.close();
    process.exit(code ?? 0);
  });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});