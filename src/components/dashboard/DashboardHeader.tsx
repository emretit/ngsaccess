interface DashboardHeaderProps {
  userName: string;
  projectName?: string;
}

export default function DashboardHeader({ userName, projectName }: DashboardHeaderProps) {
  return (
    <div className="space-y-1">
      <h1 className="text-2xl font-bold text-foreground">Hoş geldin, {userName}</h1>
      {projectName && <p className="text-sm text-muted-foreground">{projectName} · Proje özeti</p>}
    </div>
  );
}
