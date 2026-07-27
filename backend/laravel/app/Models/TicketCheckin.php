<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TicketCheckin extends Model
{
    use HasFactory;

    protected $fillable = [
        'ticket_id',
        'checked_in_by',
        'ip_address',
    ];

    public function ticket()
    {
        return $this->belongsTo(Ticket::class);
    }

    public function checker()
    {
        return $this->belongsTo(Admin::class, 'checked_in_by');
    }
}
