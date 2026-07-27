<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Ticket extends Model
{
    use HasFactory;

    protected $fillable = [
        'ticket_code',
        'security_token',
        'qr_token',
        'ticket_order_id',
        'ticket_type_id',
        'user_id',
        'holder_name',
        'holder_email',
        'holder_phone',
        'status',
        'checked_in_at',
        'scanned_at',
        'scanned_by',
    ];

    protected $casts = [
        'checked_in_at' => 'datetime',
        'scanned_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::creating(function (self $ticket): void {
            if (blank($ticket->ticket_code)) {
                $ticket->ticket_code = (string) Str::uuid();
            }
        });
    }

    public function order()
    {
        return $this->belongsTo(TicketOrder::class, 'ticket_order_id');
    }

    public function ticketType()
    {
        return $this->belongsTo(TicketType::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function checkins()
    {
        return $this->hasMany(TicketCheckin::class);
    }

    public function scannedBy()
    {
        return $this->belongsTo(Admin::class, 'scanned_by');
    }

    public function scans()
    {
        return $this->hasMany(TicketScan::class);
    }

    public function event()
    {
        return $this->hasOneThrough(
            Event::class,
            TicketType::class,
            'id',
            'id',
            'ticket_type_id',
            'event_id',
        );
    }

    public function isValid(): bool
    {
        return $this->status === 'valid';
    }

    public function isCheckedIn(): bool
    {
        return $this->checked_in_at !== null;
    }
}
