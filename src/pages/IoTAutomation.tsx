import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useTuyaDevices } from '@/hooks/useTuyaDevices';
import { useIoTSchedules } from '@/hooks/useIoTSchedules';
import { TuyaConfigCard } from '@/components/settings/TuyaConfigCard';
import { 
  Lightbulb, 
  Power, 
  RefreshCw, 
  Settings, 
  Clock, 
  Home,
  Wifi,
  WifiOff,
  Plus,
  Trash2,
  Loader2,
  Zap,
  PowerOff
} from 'lucide-react';

const DAYS_OF_WEEK = [
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
  { value: 7, label: 'Dom' },
];

export default function IoTAutomation() {
  const { 
    devices, 
    isLoading, 
    isSyncing, 
    fetchDevices, 
    syncDevices, 
    controlDevice,
    updateDeviceRoom,
  } = useTuyaDevices();

  const {
    schedules,
    isLoading: schedulesLoading,
    fetchSchedules,
    createSchedule,
    deleteSchedule,
    toggleSchedule,
  } = useIoTSchedules();

  const [newScheduleOpen, setNewScheduleOpen] = useState(false);
  const [newSchedule, setNewSchedule] = useState({
    device_id: '',
    name: '',
    action: 'turn_off' as 'turn_on' | 'turn_off',
    time: '18:00',
    days_of_week: [1, 2, 3, 4, 5],
  });

  useEffect(() => {
    fetchDevices();
    fetchSchedules();
  }, [fetchDevices, fetchSchedules]);

  const getDeviceIcon = (category: string) => {
    if (category === 'lamp' || category === 'dj' || category.includes('light')) {
      return <Lightbulb className="h-5 w-5" />;
    }
    return <Power className="h-5 w-5" />;
  };

  const getDeviceCommand = (category: string) => {
    if (category === 'lamp' || category === 'dj' || category.includes('light')) {
      return 'switch_led';
    }
    return 'switch_1';
  };

  const rooms = [...new Set(devices.map(d => d.room).filter(Boolean))] as string[];
  const devicesByRoom = rooms.reduce((acc, room) => {
    acc[room] = devices.filter(d => d.room === room);
    return acc;
  }, {} as Record<string, typeof devices>);
  const devicesWithoutRoom = devices.filter(d => !d.room);

  const handleCreateSchedule = async () => {
    if (!newSchedule.device_id || !newSchedule.name || !newSchedule.time) return;
    
    await createSchedule(newSchedule);
    setNewScheduleOpen(false);
    setNewSchedule({
      device_id: '',
      name: '',
      action: 'turn_off',
      time: '18:00',
      days_of_week: [1, 2, 3, 4, 5],
    });
  };

  const handleControlAll = async (action: 'on' | 'off') => {
    const onlineDevices = devices.filter(d => d.is_online);
    for (const device of onlineDevices) {
      await controlDevice(
        device.id, 
        device.tuya_device_id, 
        getDeviceCommand(device.category),
        action === 'on'
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Automação IoT</h1>
          <p className="text-muted-foreground">
            Controle lâmpadas e tomadas inteligentes da escola
          </p>
        </div>
        <Button onClick={syncDevices} disabled={isSyncing}>
          {isSyncing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Sincronizar
        </Button>
      </div>

      <Tabs defaultValue="devices" className="space-y-4">
        <TabsList>
          <TabsTrigger value="devices" className="flex items-center gap-1">
            <Power className="h-4 w-4" />
            Dispositivos
          </TabsTrigger>
          <TabsTrigger value="rooms" className="flex items-center gap-1">
            <Home className="h-4 w-4" />
            Por Sala
          </TabsTrigger>
          <TabsTrigger value="schedules" className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            Agendamentos
          </TabsTrigger>
          <TabsTrigger value="config" className="flex items-center gap-1">
            <Settings className="h-4 w-4" />
            Configuração
          </TabsTrigger>
        </TabsList>

        <TabsContent value="devices" className="space-y-4">
          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Controle Rápido</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-3">
              <Button 
                variant="outline" 
                onClick={() => handleControlAll('on')}
                disabled={devices.length === 0}
              >
                <Zap className="mr-2 h-4 w-4" />
                Ligar Tudo
              </Button>
              <Button 
                variant="outline" 
                onClick={() => handleControlAll('off')}
                disabled={devices.length === 0}
              >
                <PowerOff className="mr-2 h-4 w-4" />
                Desligar Tudo
              </Button>
            </CardContent>
          </Card>

          {/* Device List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : devices.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Lightbulb className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhum dispositivo</h3>
                <p className="text-muted-foreground text-center max-w-md mb-4">
                  Configure suas credenciais Tuya e clique em "Sincronizar" para importar seus dispositivos.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {devices.map(device => (
                <Card key={device.id} className={device.is_on ? 'ring-2 ring-primary' : ''}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${device.is_on ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                          {getDeviceIcon(device.category)}
                        </div>
                        <div>
                          <h3 className="font-medium">{device.name}</h3>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            {device.is_online ? (
                              <><Wifi className="h-3 w-3" /> Online</>
                            ) : (
                              <><WifiOff className="h-3 w-3" /> Offline</>
                            )}
                          </div>
                        </div>
                      </div>
                      <Badge variant={device.is_on ? 'default' : 'secondary'}>
                        {device.is_on ? 'ON' : 'OFF'}
                      </Badge>
                    </div>

                    {device.room && (
                      <p className="text-sm text-muted-foreground mb-3">
                        📍 {device.room}
                      </p>
                    )}

                    <div className="flex items-center justify-between">
                      <span className="text-sm">
                        {device.is_on ? 'Ligado' : 'Desligado'}
                      </span>
                      <Switch
                        checked={device.is_on || false}
                        disabled={!device.is_online}
                        onCheckedChange={(checked) => 
                          controlDevice(
                            device.id, 
                            device.tuya_device_id, 
                            getDeviceCommand(device.category),
                            checked
                          )
                        }
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="rooms" className="space-y-4">
          {rooms.length === 0 && devicesWithoutRoom.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Home className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhum dispositivo organizado</h3>
                <p className="text-muted-foreground text-center">
                  Sincronize seus dispositivos e organize-os por sala.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {rooms.map(room => (
                <Card key={room}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Home className="h-5 w-5" />
                        {room}
                      </CardTitle>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          const roomDevices = devicesByRoom[room];
                          const allOn = roomDevices.every(d => d.is_on);
                          roomDevices.forEach(device => {
                            if (device.is_online) {
                              controlDevice(
                                device.id,
                                device.tuya_device_id,
                                getDeviceCommand(device.category),
                                !allOn
                              );
                            }
                          });
                        }}
                      >
                        {devicesByRoom[room]?.every(d => d.is_on) ? 'Desligar Sala' : 'Ligar Sala'}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {devicesByRoom[room]?.map(device => (
                        <div 
                          key={device.id} 
                          className="flex items-center justify-between p-3 rounded-lg border"
                        >
                          <div className="flex items-center gap-2">
                            {getDeviceIcon(device.category)}
                            <span className="text-sm font-medium">{device.name}</span>
                          </div>
                          <Switch
                            checked={device.is_on || false}
                            disabled={!device.is_online}
                            onCheckedChange={(checked) => 
                              controlDevice(
                                device.id, 
                                device.tuya_device_id, 
                                getDeviceCommand(device.category),
                                checked
                              )
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}

              {devicesWithoutRoom.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-muted-foreground">
                      <Home className="h-5 w-5" />
                      Sem Sala Definida
                    </CardTitle>
                    <CardDescription>
                      Edite os dispositivos para organizá-los por sala
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {devicesWithoutRoom.map(device => (
                        <div 
                          key={device.id} 
                          className="flex items-center justify-between p-3 rounded-lg border"
                        >
                          <div className="flex items-center gap-2">
                            {getDeviceIcon(device.category)}
                            <span className="text-sm font-medium">{device.name}</span>
                          </div>
                          <Select
                            value={device.room || ''}
                            onValueChange={(value) => updateDeviceRoom(device.id, value)}
                          >
                            <SelectTrigger className="w-32 h-8">
                              <SelectValue placeholder="Definir sala" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Sala 1">Sala 1</SelectItem>
                              <SelectItem value="Sala 2">Sala 2</SelectItem>
                              <SelectItem value="Sala 3">Sala 3</SelectItem>
                              <SelectItem value="Corredor">Corredor</SelectItem>
                              <SelectItem value="Recepção">Recepção</SelectItem>
                              <SelectItem value="Banheiro">Banheiro</SelectItem>
                              <SelectItem value="Cozinha">Cozinha</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="schedules" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={newScheduleOpen} onOpenChange={setNewScheduleOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Agendamento
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Criar Agendamento</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Nome</Label>
                    <Input
                      value={newSchedule.name}
                      onChange={(e) => setNewSchedule(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Ex: Desligar ao fim do expediente"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Dispositivo</Label>
                    <Select
                      value={newSchedule.device_id}
                      onValueChange={(value) => setNewSchedule(prev => ({ ...prev, device_id: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um dispositivo" />
                      </SelectTrigger>
                      <SelectContent>
                        {devices.map(device => (
                          <SelectItem key={device.id} value={device.id}>
                            {device.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Ação</Label>
                      <Select
                        value={newSchedule.action}
                        onValueChange={(value: 'turn_on' | 'turn_off') => 
                          setNewSchedule(prev => ({ ...prev, action: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="turn_on">Ligar</SelectItem>
                          <SelectItem value="turn_off">Desligar</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Horário</Label>
                      <Input
                        type="time"
                        value={newSchedule.time}
                        onChange={(e) => setNewSchedule(prev => ({ ...prev, time: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Dias da Semana</Label>
                    <div className="flex gap-2">
                      {DAYS_OF_WEEK.map(day => (
                        <Button
                          key={day.value}
                          type="button"
                          variant={newSchedule.days_of_week.includes(day.value) ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => {
                            setNewSchedule(prev => ({
                              ...prev,
                              days_of_week: prev.days_of_week.includes(day.value)
                                ? prev.days_of_week.filter(d => d !== day.value)
                                : [...prev.days_of_week, day.value].sort()
                            }));
                          }}
                        >
                          {day.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <Button 
                    onClick={handleCreateSchedule} 
                    className="w-full"
                    disabled={!newSchedule.device_id || !newSchedule.name}
                  >
                    Criar Agendamento
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {schedulesLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : schedules.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhum agendamento</h3>
                <p className="text-muted-foreground text-center">
                  Crie agendamentos para automatizar seus dispositivos.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {schedules.map(schedule => {
                const device = devices.find(d => d.id === schedule.device_id);
                return (
                  <Card key={schedule.id}>
                    <CardContent className="flex items-center justify-between py-4">
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg ${schedule.is_active ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                          <Clock className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="font-medium">{schedule.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {device?.name || 'Dispositivo não encontrado'} • {schedule.time} • {schedule.action === 'turn_on' ? 'Ligar' : 'Desligar'}
                          </p>
                          <div className="flex gap-1 mt-1">
                            {schedule.days_of_week.map(day => (
                              <Badge key={day} variant="outline" className="text-xs">
                                {DAYS_OF_WEEK.find(d => d.value === day)?.label}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={schedule.is_active || false}
                          onCheckedChange={(checked) => toggleSchedule(schedule.id, checked)}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteSchedule(schedule.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="config">
          <TuyaConfigCard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
